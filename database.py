import sqlite3

class NBA_DB:
    def __init__(self, db_name="nba_game.db"):
        self.conn = sqlite3.connect(db_name)
        self.conn.row_factory = sqlite3.Row 
        self.cursor = self.conn.cursor()
        self.create_tables()

    def create_tables(self):
        # 1. Users
        self.cursor.execute('''CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            balance REAL DEFAULT 250.0)''')
        
        # 2. Player Library
        self.cursor.execute('''CREATE TABLE IF NOT EXISTS player_cards (
            player_id INTEGER PRIMARY KEY,
            name TEXT,
            team TEXT,
            last_season_pra REAL DEFAULT 0.0,
            curr_season_pra REAL DEFAULT 0.0,
            gp_last_season INTEGER DEFAULT 0,
            gp_last_15 INTEGER DEFAULT 0)''')

        # 3. Player Inventory (Unique constraint prevents the "Two Lukas" issue)
        self.cursor.execute('''CREATE TABLE IF NOT EXISTS inventory (
            user_id INTEGER, 
            player_id INTEGER,
            UNIQUE(user_id, player_id),
            FOREIGN KEY(user_id) REFERENCES users(id),
            FOREIGN KEY(player_id) REFERENCES player_cards(player_id))''')

        # 4. NEW: Pack Inventory (This is what caused your error!)
        self.cursor.execute('''CREATE TABLE IF NOT EXISTS inventory_packs (
            user_id INTEGER,
            pack_type TEXT,
            count INTEGER DEFAULT 0,
            PRIMARY KEY (user_id, pack_type),
            FOREIGN KEY(user_id) REFERENCES users(id))''')

        self.cursor.execute('''CREATE TABLE IF NOT EXISTS processed_days (
            game_date TEXT PRIMARY KEY)''')

        self.conn.commit()

    def mark_date_processed(self, date_str):
        self.cursor.execute("INSERT OR IGNORE INTO processed_days (game_date) VALUES (?)", (date_str,))
        self.conn.commit()

    def is_date_processed(self, date_str):
        self.cursor.execute("SELECT 1 FROM processed_days WHERE game_date = ?", (date_str,))
        return self.cursor.fetchone() is not None

    def add_revenue(self, user_id, amount):
        """Adds generated revenue to the user's balance."""
        self.cursor.execute("UPDATE users SET balance = balance + ? WHERE id = ?", (amount, user_id))
        self.conn.commit()
    # --- PACK MANAGEMENT ---
    def get_price(self, player_id):
        """Returns the specific 2026 market price based on card rarity."""
        rarity = self.get_rarity(player_id)
        # Clean icons for comparison
        clean_rarity = rarity.replace("💎 ", "").replace("💍 ", "").replace("🥇 ", "").replace("🥈 ", "").replace("🥉 ", "").replace("⚙️ ", "").upper()
        
        # Standardized pricing based on your request
        prices = {
            "DIAMOND": 1000, "PLATINUM": 500, "GOLD": 200,
            "SILVER": 75, "BRONZE": 25, "IRON": 5
        }
        return prices.get(clean_rarity, 5)

    def add_pack_to_inventory(self, user_id, pack_type):
        """Adds a pack to the user's inventory using Upsert logic."""
        self.cursor.execute("""
            INSERT INTO inventory_packs (user_id, pack_type, count) 
            VALUES (?, ?, 1)
            ON CONFLICT(user_id, pack_type) DO UPDATE SET count = count + 1
        """, (user_id, pack_type))
        self.conn.commit()

    def get_user_packs(self, user_id):
        self.cursor.execute("SELECT pack_type, count FROM inventory_packs WHERE user_id = ? AND count > 0", (user_id,))
        return self.cursor.fetchall()


    def add_user(self, username):
        try:
            self.cursor.execute("INSERT INTO users (username) VALUES (?)", (username,))
            self.conn.commit()
        except sqlite3.IntegrityError: pass
        return self.get_user(username)

    def get_user(self, username):
        self.cursor.execute("SELECT * FROM users WHERE username = ?", (username,))
        return self.cursor.fetchone()

    def add_card_to_inventory(self, user_id, player_id):
        """Adds a card only if the user doesn't already own it."""
        try:
            self.cursor.execute("INSERT OR IGNORE INTO inventory (user_id, player_id) VALUES (?, ?)", (user_id, player_id))
            self.conn.commit()
            return self.cursor.rowcount > 0 # Returns True if a card was actually added
        except sqlite3.Error:
            return False

    def get_user_collection(self, user_id):
        query = "SELECT p.player_id, p.name, p.team FROM inventory i JOIN player_cards p ON i.player_id = p.player_id WHERE i.user_id = ?"
        self.cursor.execute(query, (user_id,))
        return self.cursor.fetchall()

    def add_master_card(self, p_id, name, team, last_pra, curr_pra, gp_l, gp_r):
        self.cursor.execute('''INSERT OR REPLACE INTO player_cards 
            (player_id, name, team, last_season_pra, curr_season_pra, gp_last_season, gp_last_15) 
            VALUES (?, ?, ?, ?, ?, ?, ?)''', (p_id, name, team, last_pra, curr_pra, gp_l, gp_r))
        self.conn.commit()

    def get_player_info(self, search_name, user_id):
        query = """
            SELECT p.player_id, p.name, p.team,
            EXISTS(SELECT 1 FROM inventory WHERE user_id = ? AND player_id = p.player_id) as owned
            FROM player_cards p WHERE p.name LIKE ?
        """
        self.cursor.execute(query, (user_id, f"%{search_name}%"))
        return self.cursor.fetchone()

    def get_total_score(self, player_id):
        self.cursor.execute("SELECT * FROM player_cards WHERE player_id = ?", (player_id,))
        p = self.cursor.fetchone()
        if not p: return 0.0
        
        # 1. Performance: 85% Current / 15% Last Season
        base_pra = (p['last_season_pra'] * 0.15) + (p['curr_season_pra'] * 0.85)
        
        # 2. Raw Reliability: 70% Recent / 30% Last Season
        rel_raw = ( (p['gp_last_season'] / 82.0) * 0.30 ) + ( (p['gp_last_15'] / 15.0) * 0.70 )
        
        # 3. The "Balanced" Buffer (70/30)
        # 0.70 is the floor. 0.30 is the variable range.
        # Perfect health = 1.0 multiplier | Zero health = 0.70 multiplier
        balanced_rel = 0.3 + (0.7 * rel_raw)
        
        return round(base_pra * balanced_rel, 2)

    def get_rarity(self, player_id):
        """Calculates rarity based on Global 2026 NBA Benchmarks."""
        score = self.get_total_score(player_id)
        
        # --- GLOBAL 2026 THRESHOLDS ---
        # These reflect the real percentiles for the ~450 players in the NBA.
        if score >= 30.0: return "💎 DIAMOND"   # Top 7.5% (The Superstars)
        if score >= 27.0: return "💍 PLATINUM"  # Next 12.5% (All-Stars)
        if score >= 23.0: return "🥇 GOLD"      # Next 17% (High-level Starters)
        if score >= 17.0: return "🥈 SILVER"    # Next 19% (Rotation Players)
        if score >= 10.0: return "🥉 BRONZE"    # Next 21% (End of Bench)
        return "⚙️ IRON"                         # Last 23% (Deep Bench/Bronny)

    def get_players_by_tier(self, tier_name):
        self.cursor.execute("SELECT player_id FROM player_cards")
        all_ids = [row['player_id'] for row in self.cursor.fetchall()]
        # Matches the icon-stripped string to allow 'rank Diamond' to work
        return [pid for pid in all_ids if tier_name.upper() in self.get_rarity(pid)]


    def process_purchase(self, user_id, player_id, price):
        """Deducts balance and adds card to inventory."""
        self.cursor.execute("SELECT balance FROM users WHERE id = ?", (user_id,))
        user_balance = self.cursor.fetchone()['balance']
        
        if user_balance < price:
            return False, f"❌ Insufficient funds! You need ${price - user_balance:.2f} more."
        
        # Atomic Update
        self.cursor.execute("UPDATE users SET balance = balance - ? WHERE id = ?", (price, user_id))
        self.cursor.execute("INSERT INTO inventory (user_id, player_id) VALUES (?, ?)", (user_id, player_id))
        self.conn.commit()
        return True, "✅ Purchase successful!"

    def get_rarity_icon(self, tier_name):
        """Maps tier names to their respective icons for the UI."""
        icons = {
            "DIAMOND": "💎",
            "PLATINUM": "💍",
            "GOLD": "🥇",
            "SILVER": "🥈",
            "BRONZE": "🥉",
            "IRON": "⚙️"
        }
        return icons.get(tier_name.upper(), "❓")

    def get_tier_leaders(self, tier_name, limit=20):
        thresholds = {
            "DIAMOND": 30.0, "PLATINUM": 27.0, "GOLD": 23.0,
            "SILVER": 17.0, "BRONZE": 10.0, "IRON": 0.0
        }
        
        tier_upper = tier_name.upper()
        min_score = thresholds.get(tier_upper, 0.0)
        
        # Ceiling logic for contiguous tiers
        max_score = 1000.0
        if tier_upper == "PLATINUM": max_score = 29.99
        elif tier_upper == "GOLD":   max_score = 26.99
        elif tier_upper == "SILVER": max_score = 22.99
        elif tier_upper == "BRONZE": max_score = 17.99
        elif tier_upper == "IRON":   max_score = 9.99

        # Updated SQL with the 0.70 floor logic
        query = f"""
            SELECT name, team, 
            (
                (last_season_pra * 0.15 + curr_season_pra * 0.85) 
                * (0.3 + (0.7 * ((gp_last_season / 82.0 * 0.25) + (gp_last_15 / 15.0 * 0.75))))
            ) as final_score
            FROM player_cards
            WHERE final_score >= ? AND final_score < ?
            ORDER BY final_score DESC
            LIMIT ?
        """
        
        self.cursor.execute(query, (min_score, max_score, limit))
        return self.cursor.fetchall()
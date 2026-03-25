import time
import random
from database import NBA_DB
from nba_api.stats.endpoints import playergamelogs
from nba_api.stats.endpoints import commonallplayers, playercareerstats, playergamelog
from nba_api.stats.static import players
from nba_api.stats.endpoints import leaguedashplayerstats
from datetime import datetime, timedelta

db = NBA_DB()

PULL_RATES = {
    "Common Pack":    [0.0025, 0.0075, 0.01, 0.18, 0.50, 0.40],
    "Rare Pack":      [0.005, 0.015, 0.25, 0.45, 0.18, 0.1],
    "Legendary Pack": [0.01, 0.175, 0.425, 0.25, 0.1, 0.05]
}

TIERS = ["💎 DIAMOND", "💍 PLATINUM", "🥇 GOLD", "🥈 SILVER", "🥉 BRONZE", "⚙️ IRON"]

# --- PACK CONFIGURATION ---
# All packs contain 5 cards
PACK_CONFIG = {
    "Common Pack":    {"price": 100,  "tier": "Common",    "cards": 5},
    "Rare Pack":      {"price": 500,  "tier": "Rare",      "cards": 5},
    "Legendary Pack": {"price": 2500, "tier": "Legendary", "cards": 5}
}

def seed_league():
    """Imports the entire NBA player database with 2026 stats in 3 API calls."""
    print("🌍 Connecting to NBA Global Database (March 2026)...")
    
    try:
        # 1. Fetch ALL players for Current Season (2025-26)
        print("📊 Fetching current season averages...")
        curr_stats = leaguedashplayerstats.LeagueDashPlayerStats(season='2025-26', per_mode_detailed='PerGame').get_data_frames()[0]
        
        # 2. Fetch ALL players for Last Season (2024-25)
        print("📜 Fetching last season historical data...")
        last_stats = leaguedashplayerstats.LeagueDashPlayerStats(season='2024-25', per_mode_detailed='PerGame').get_data_frames()[0]
        
        # 3. Fetch Recent Reliability (Last 15 Games) for everyone
        print("🕒 Calculating recent reliability (Last 15 games)...")
        recent_stats = leaguedashplayerstats.LeagueDashPlayerStats(season='2025-26', last_n_games=15).get_data_frames()[0]

        # Convert to dictionaries for fast lookup
        last_map = {row['PLAYER_ID']: row for _, row in last_stats.iterrows()}
        recent_map = {row['PLAYER_ID']: row['GP'] for _, row in recent_stats.iterrows()}

        print(f"🧬 Processing {len(curr_stats)} players...")
        for _, row in curr_stats.iterrows():
            p_id = int(row['PLAYER_ID'])
            name = row['PLAYER_NAME']
            team = row['TEAM_ABBREVIATION']
            
            # Current PRA
            curr_pra = row['PTS'] + row['REB'] + row['AST']
            
            # Historical Data (Last Season)
            last_data = last_map.get(p_id, {'PTS': 0, 'REB': 0, 'AST': 0, 'GP': 0})
            last_pra = last_data['PTS'] + last_data['REB'] + last_data['AST']
            gp_last = int(last_data['GP'])
            
            # Recent Reliability
            gp_recent = int(recent_map.get(p_id, 0))

            # Mint the Card in the Master Library
            db.add_master_card(p_id, name, team, last_pra, curr_pra, gp_last, gp_recent)

        print("✅ NBA Global Database Import Complete! 450+ players synced.")
        
    except Exception as e:
        print(f"❌ Global Seed Failed: {e}")

def open_pack(user_id, pack_type):
    """Processes the RNG for a pack opening and adds cards to inventory."""
    # 1. Check if user actually has the pack
    db.cursor.execute("SELECT count FROM inventory_packs WHERE user_id = ? AND pack_type = ?", (user_id, pack_type))
    res = db.cursor.fetchone()
    if not res or res['count'] <= 0:
        print("❌ You don't have any of those packs!")
        return

    # 2. Consume the pack
    db.cursor.execute("UPDATE inventory_packs SET count = count - 1 WHERE user_id = ? AND pack_type = ?", (user_id, pack_type))
    db.conn.commit()

    print(f"\n✨ OPENING {pack_type.upper()}... ✨")
    
    # Get a list of all player_ids the user ALREADY owns to exclude them
    db.cursor.execute("SELECT player_id FROM inventory WHERE user_id = ?", (user_id,))
    owned_ids = [row['player_id'] for row in db.cursor.fetchall()]

    new_pulls = []
    rates = PULL_RATES.get(pack_type)

    for i in range(5):
        # 1. Roll for the tier
        rolled_tier = random.choices(TIERS, weights=rates)[0]
        
        # 2. Get all players in that tier
        db.cursor.execute("SELECT player_id, name, team FROM player_cards")
        all_players = db.cursor.fetchall()
        
        # 3. Filter: Tier matches AND user doesn't own them AND not already pulled in this pack
        eligible = [p for p in all_players if db.get_rarity(p['player_id']) == rolled_tier 
                    and p['player_id'] not in owned_ids 
                    and p['player_id'] not in [x['player_id'] for x in new_pulls]]

        # Fallback: if you own EVERYONE in a tier, pull from a lower tier
        if not eligible:
            eligible = [p for p in all_players if p['player_id'] not in owned_ids]

        if eligible:
            selected = random.choice(eligible)
            db.add_card_to_inventory(user_id, selected['player_id'])
            new_pulls.append(selected)
            print(f"Card {i+1}: {rolled_tier} | {selected['name']} ({selected['team']})")
        else:
            print(f"Card {i+1}: 💰 Shop Credit (You own every available player!)")
            db.cursor.execute("UPDATE users SET balance = balance + 50 WHERE id = ?", (user_id,))
            db.conn.commit()

    print("\n✅ Pack opening complete!")

def fetch_actual_team(player_id):
    """Scans the active 2025-26 roster for the most accurate team data."""
    try:
        all_players = commonallplayers.CommonAllPlayers(is_only_current_season=1)
        df = all_players.get_data_frames()[0]
        player_row = df[df['PERSON_ID'] == player_id]
        
        if not player_row.empty:
            team = player_row['TEAM_ABBREVIATION'].iloc[0]
            return team if team and team != "NBA" else "FA" 
        return "NBA"
    except Exception as e:
        print(f"⚠️ Roster scan failed: {e}")
        return "NBA"

def discover_player(search_term, user_id=None):
    """Handles Rookies and Veterans. user_id is optional for starter selection."""
    all_nba = players.get_players()
    match = next((p for p in all_nba if p['full_name'].lower() == search_term.lower()), None)
    if not match: return None
    
    try:
        p_id = match['id']
        career = playercareerstats.PlayerCareerStats(player_id=p_id)
        df = career.get_data_frames()[0]
        
        # Last Season (24-25)
        last_s_rows = df[df['SEASON_ID'] == '2024-25']
        if not last_s_rows.empty:
            last_s = last_s_rows.iloc[0]
            last_pra = (last_s['PTS'] + last_s['REB'] + last_s['AST']) / last_s['GP']
            gp_last = int(last_s['GP'])
        else:
            last_pra, gp_last = 0.0, 0 

        # Current Season (25-26)
        curr_s_rows = df[df['SEASON_ID'] == '2025-26']
        if curr_s_rows.empty:
            return None
            
        curr_s = curr_s_rows.iloc[0]
        curr_pra = (curr_s['PTS'] + curr_s['REB'] + curr_s['AST']) / curr_s['GP']
        
        # Recent 15
        log = playergamelog.PlayerGameLog(player_id=p_id, season='2025-26')
        gp_recent = len(log.get_data_frames()[0].head(15))

        team = fetch_actual_team(p_id)
        db.add_master_card(p_id, match['full_name'], team, last_pra, curr_pra, gp_last, gp_recent)
        
        return db.get_player_info(match['full_name'], user_id)
    except Exception as e:
        return None

def initialize_cards():
    """Only seeds the league if it hasn't been done yet."""
    db.cursor.execute("SELECT COUNT(*) as count FROM player_cards")
    if db.cursor.fetchone()['count'] < 10:
        seed_league() # This ensures names/stats are synced with the API
    print("✅ System Synced with NBA Global Data.")

def show_help():
    print("\n" + "="*45)
    print(f"{'Command':<12} | {'Description'}")
    print("-" * 45)
    print(f"{'shop':<12} | View available cards for sale")
    print(f"{'buy [name]':<12} | Purchase a card from the shop")
    print(f"{'view [name]':<12} | Scout a player to add to the shop")
    print(f"{'collection':<12} | See your Diamond and Evo-Cards")
    print(f"{'balance':<12} | Check your wallet")
    print("="*45)


def sync_revenue(user_data):
    """Checks the last 2 days for games and pays out revenue based on PRA."""
    today = datetime.now().strftime('%m/%d/%Y')
    yesterday = (datetime.now() - timedelta(1)).strftime('%m/%d/%Y')
    
    dates_to_check = [yesterday, today]
    total_earned = 0.0

    print("📡 Syncing with NBA Satellite (March 2026)...")

    for d in dates_to_check:
        if db.is_date_processed(d):
            continue

        try:
            # --- CRITICAL FIX: Use PlayerGameLogs (Plural) ---
            response = playergamelogs.PlayerGameLogs(
                season_nullable='2025-26', 
                date_from_nullable=d, 
                date_to_nullable=d,
                league_id_nullable='00'
            )
            
            log = response.get_data_frames()[0]

            if log.empty:
                # If it's a game day but no games have finished yet
                continue

            # Get user's inventory IDs
            inventory = [row['player_id'] for row in db.get_user_collection(user_data['id'])]
            
            # Match logs to your players
            owned_performance = log[log['PLAYER_ID'].isin(inventory)]
            
            if not owned_performance.empty:
                # Calculate Daily PRA: (Points + Rebounds + Assists)
                daily_pra = (owned_performance['PTS'] + owned_performance['REB'] + owned_performance['AST']).sum()
                revenue = round(daily_pra / 2.5, 2)
                
                if revenue > 0:
                    db.add_revenue(user_data['id'], revenue)
                    total_earned += revenue
                    print(f"💰 Revenue for {d}: +${revenue} (Team PRA: {daily_pra})")
            
            db.mark_date_processed(d)

        except Exception as e:
            # This catches common connection timeouts or API shifts
            print(f"⚠️ Sync skipped for {d} (No finalized data yet)")

    if total_earned > 0:
        print(f"✅ Sync complete! New Balance: ${db.get_user(user_data['username'])['balance']:.2f}")
    else:
        print("📭 No new game revenue to collect right now.")

def main():
    initialize_cards()
    
    # NEW: Check if we need to import the whole league
    db.cursor.execute("SELECT COUNT(*) as count FROM player_cards")
    if db.cursor.fetchone()['count'] < 10:
        seed_league()
    print("\n=== 🏀 NBA EVO-CARDS 2026: LIVE ROSTERS ===")
    
    username = input("Username: ").strip()
    user_data = db.get_user(username)

    if not user_data:
        print(f"\nWelcome, {username}! Since you're new, you can scout your own starter.")
        print("Type the full name of ANY NBA player to see their current 2026 rank.")
        
        starter_id = None
        while True:
            search_name = input("\nScout player name: ").strip()
            if not search_name: continue
            
            # Search Master DB or Fetch from API
            player = db.get_player_info(search_name, None) or discover_player(search_name, None)
            
            if player:
                p_id = player['player_id']
                score = db.get_total_score(p_id)
                rarity = db.get_rarity(p_id)
                
                print(f"\n--- 🔍 SCOUTING REPORT ---")
                print(f"Name:   {player['name']}")
                print(f"Team:   {player['team']}")
                print(f"Rank:   {rarity}")
                print(f"Points: {score}")
                print("-" * 26)
                
                confirm = input(f"Confirm {player['name']} as your starter? (yes/no): ").lower().strip()
                if confirm == 'yes':
                    starter_id = p_id
                    break
                else:
                    print("Scouting continues...")
            else:
                print("❌ Player not found. Try a full name like 'Stephen Curry' or 'Cooper Flagg'.")

        db.add_user(username)
        user_data = db.get_user(username)
        db.add_card_to_inventory(user_data['id'], starter_id)
        print(f"\n✅ Starter confirmed! {player['name']} added to your collection.")

    print(f"\nLogged in as {user_data['username']}. Type 'help' for commands.")

    sync_revenue(user_data) # Automatic sync on login
    user_data = db.get_user(user_data['username']) # Refresh balance after sync
    show_help()
    while True:
        line = input(f"\n[{user_data['username']}] > ").strip()
        if not line: continue
        parts = line.split(" ", 1)
        cmd = parts[0].lower()

        if cmd == "exit":
            break
        elif cmd == "sync":
            sync_revenue(user_data)
            user_data = db.get_user(user_data['username'])
        elif cmd == "help":
            show_help()
        elif cmd == "balance":
            print(f"💰 Balance: ${user_data['balance']:.2f}")
        elif cmd == "view":
            if len(parts) < 2: 
                print("Usage: view [player name]")
                continue
            player = db.get_player_info(parts[1], user_data['id']) or discover_player(parts[1], user_data['id'])
            if player:
                p_id = player['player_id']
                score = db.get_total_score(p_id)
                rarity = db.get_rarity(p_id)
                status = "✅ [OWNED]" if player['owned'] else "❌ [NOT OWNED]"
                print(f"\n{rarity} | {player['name']} ({player['team']})")
                print(f"Final Rank Point: {score}")
                print(f"Status: {status}")
            else:
                print("❌ Player not found.")
        elif cmd == "rank":
            if len(parts) < 2:
                print("Usage: rank [Diamond/Platinum/Gold/Silver/Bronze/Iron]")
                continue
            
            tier_input = parts[1].strip().upper()
            leaders = db.get_tier_leaders(tier_input, limit=20)
            
            if not leaders:
                print(f"No players currently found in the {tier_input.capitalize()} tier.")
            else:
                icon = db.get_rarity_icon(tier_input)
                print(f"\n{icon} {tier_input} TIER LEADERS (Top 20)")
                print(f"{'#':<3} | {'Name':<25} | {'Team':<6} | {'Rank Pts'}")
                print("-" * 50)
                
                for i, row in enumerate(leaders, 1):
                    print(f"{i:<3} | {row['name']:<25} | {row['team']:<6} | {row['final_score']:.2f}")

        elif cmd == "shop":
            print("\n" + "🛒" + "═"*20 + " 2026 PACK MARKET " + "═"*20)
            print(f"{'Pack Name':<20} | {'Price':<8} | {'Contents'}")
            print("-" * 55)
            for name, data in PACK_CONFIG.items():
                print(f"{name:<20} | ${data['price']:<7} | {data['cards']} Cards")
            print("-" * 55)
            print("To buy: 'buy [Pack Name]' or 'buy [Player Name]'")

        elif cmd == "buy":
            if len(parts) < 2:
                print("Usage: buy [Full Name] or [Pack Name]")
                continue
            
            item = parts[1].strip()
            
            # 1. HANDLE PACK PURCHASES
            if item in PACK_CONFIG:
                price = PACK_CONFIG[item]['price']
                if user_data['balance'] >= price:
                    confirm = input(f"Confirm purchase of {item} for ${price}? (y/n): ").lower()
                    if confirm == 'y':
                        # Deduct balance
                        db.cursor.execute("UPDATE users SET balance = balance - ? WHERE id = ?", (price, user_data['id']))
                        # Add pack to inventory
                        db.add_pack_to_inventory(user_data['id'], item)
                        # Refresh local user data to show new balance
                        user_data = db.get_user(user_data['username'])
                        print(f"✅ {item} purchased! You can view it in your 'collection'.")
                else:
                    print(f"❌ Insufficient funds. You need ${price - user_data['balance']} more.")

            # 2. HANDLE DIRECT PLAYER PURCHASES
            else:
                player = db.get_player_info(item, user_data['id'])
                if player:
                    price = db.get_price(player['player_id'])
                    confirm = input(f"Buy {player['name']} for ${price}? (y/n): ").lower()
                    if confirm == 'y':
                        if user_data['balance'] >= price:
                            db.cursor.execute("UPDATE users SET balance = balance - ? WHERE id = ?", (price, user_data['id']))
                            db.add_card_to_inventory(user_data['id'], player['player_id'])
                            user_data = db.get_user(user_data['username'])
                            print(f"✅ {player['name']} added to collection!")
                        else:
                            print("❌ Insufficient funds.")
                else:
                    print(f"❌ '{item}' not recognized as a pack or discovered player.")

        elif cmd == "collection":
            # Display Players
            print("\n--- 🃏 YOUR PLAYERS ---")
            cards = db.get_user_collection(user_data['id'])
            for row in cards:
                pid = row['player_id']
                print(f"[{db.get_rarity(pid)}] {row['name']} ({row['team']}) | Rank: {db.get_total_score(pid)}")
            
            # Display Owned Packs
            print("\n--- 📦 YOUR UNOPENED PACKS ---")
            packs = db.get_user_packs(user_data['id'])
            if not packs:
                print("No packs in inventory.")
            for p_type, count in packs:
                print(f"{p_type}: x{count}")

        elif cmd == "open":
            packs = db.get_user_packs(user_data['id'])
            if not packs:
                print("📦 Your pack inventory is empty! Visit the 'shop'.")
                continue
            
            print("\n--- YOUR UNOPENED PACKS ---")
            for i, (p_type, count) in enumerate(packs, 1):
                print(f"{i}. {p_type} (x{count})")
            
            try:
                choice = int(input("\nSelect a pack to open (number): ")) - 1
                pack_to_open = packs[choice]['pack_type']
                open_pack(user_data['id'], pack_to_open)
            except (ValueError, IndexError):
                print("Invalid selection.")

if __name__ == "__main__":
    main()
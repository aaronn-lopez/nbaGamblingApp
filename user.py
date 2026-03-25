import json
import os

class PlayerProfile:
    def __init__(self, username, balance=500, ranked_points=0, card_collection=None):
        self.username = username
        self.balance = balance
        self.ranked_points = ranked_points
        self.card_collection = card_collection if card_collection else []

    def add_card(self, card_name):
        """Adds a player card to the collection."""
        self.card_collection.append(card_name)
        print(f"🃏 {card_name} added to {self.username}'s collection!")

    def update_balance(self, amount):
        """Adjusts wallet. Use negative numbers for purchases."""
        if self.balance + amount < 0:
            print("❌ Insufficient funds!")
            return False
        self.self.balance += amount
        return True

    def to_dict(self):
        """Converts object to dictionary for JSON saving."""
        return {
            "username": self.username,
            "balance": self.balance,
            "ranked_points": self.ranked_points,
            "card_collection": self.card_collection
        }

    def save_data(self, filename="user_data.json"):
        """Saves profile to a local JSON file."""
        with open(filename, "w") as f:
            json.dump(self.to_dict(), f, indent=4)
        print(f"💾 Profile saved to {filename}")

    @classmethod
    def load_data(cls, filename="user_data.json"):
        """Loads profile from a local JSON file."""
        if not os.path.exists(filename):
            return None
        with open(filename, "r") as f:
            data = json.load(f)
            return cls(**data)
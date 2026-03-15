-- 2D Avatar System Schema with Real Assets

-- Base avatars (character templates users pick during onboarding)
CREATE TABLE IF NOT EXISTS base_avatars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT NOT NULL, -- Base character image
  gender TEXT NOT NULL, -- 'male', 'female'
  is_active BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Clothing items for 2D avatars (PNG layers)
CREATE TABLE IF NOT EXISTS avatar_clothing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'hair', 'top', 'bottom', 'shoes', 'accessory', 'hat', 'glasses'
  description TEXT,
  price INTEGER NOT NULL DEFAULT 0, -- price in cents
  image_url TEXT NOT NULL, -- PNG layer that goes over base avatar
  rarity TEXT DEFAULT 'common', -- 'common', 'rare', 'epic', 'legendary'
  is_default BOOLEAN DEFAULT FALSE,
  gender TEXT, -- 'male', 'female', 'unisex'
  created_at TIMESTAMP DEFAULT NOW()
);

-- User's selected base avatar
CREATE TABLE IF NOT EXISTS user_avatars (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  base_avatar_id UUID REFERENCES base_avatars(id),
  selected_at TIMESTAMP DEFAULT NOW()
);

-- User's clothing inventory
CREATE TABLE IF NOT EXISTS user_clothing_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  clothing_id UUID NOT NULL REFERENCES avatar_clothing(id) ON DELETE CASCADE,
  purchased_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, clothing_id)
);

-- User's currently equipped clothing
CREATE TABLE IF NOT EXISTS user_equipped_clothing (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  hair_id UUID REFERENCES avatar_clothing(id),
  top_id UUID REFERENCES avatar_clothing(id),
  bottom_id UUID REFERENCES avatar_clothing(id),
  shoes_id UUID REFERENCES avatar_clothing(id),
  accessory_id UUID REFERENCES avatar_clothing(id),
  hat_id UUID REFERENCES avatar_clothing(id),
  glasses_id UUID REFERENCES avatar_clothing(id),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_avatar_clothing_type ON avatar_clothing(type);
CREATE INDEX IF NOT EXISTS idx_avatar_clothing_rarity ON avatar_clothing(rarity);
CREATE INDEX IF NOT EXISTS idx_user_clothing_inventory_user ON user_clothing_inventory(user_id);
CREATE INDEX IF NOT EXISTS idx_user_equipped_clothing_user ON user_equipped_clothing(user_id);

-- Insert base avatars with real generated images
INSERT INTO base_avatars (name, description, image_url, gender, display_order) VALUES
  ('Bald Beard Guy', 'Strong and confident', 'assets/avatars/base/male-1-bald-beard.png', 'male', 1),
  ('Curly Guy', 'Laid-back and friendly', 'assets/avatars/base/male-2-curly-beard.png', 'male', 2),
  ('Athletic Guy', 'Fit and active', 'assets/avatars/base/male-3-athletic-goatee.png', 'male', 3),
  ('Ponytail Girl', 'Athletic and energetic', 'assets/avatars/base/female-1-ponytail.png', 'female', 4),
  ('Blonde Girl', 'Trendy and stylish', 'assets/avatars/base/female-2-blonde-bob.png', 'female', 5),
  ('Curvy Girl', 'Confident and bold', 'assets/avatars/base/female-3-curvy.png', 'female', 6)
ON CONFLICT DO NOTHING;

-- Insert clothing items with real generated assets
INSERT INTO avatar_clothing (name, type, description, price, image_url, is_default, gender, rarity) VALUES
  -- Hair (Free/Default)
  ('Black Curly Hair', 'hair', 'Natural black curly afro', 0, 'assets/clothing/hair/black-curly-afro.png', TRUE, 'unisex', 'common'),
  ('Brown Ponytail', 'hair', 'Long brown ponytail', 0, 'assets/clothing/hair/brown-ponytail.png', TRUE, 'female', 'common'),
  ('Blonde Bob', 'hair', 'Short blonde bob cut', 299, 'assets/clothing/hair/blonde-bob.png', FALSE, 'female', 'rare'),
  
  -- Tops
  ('Gray T-Shirt', 'top', 'Basic gray t-shirt', 0, 'assets/clothing/top/gray-tshirt.png', TRUE, 'unisex', 'common'),
  ('White Polo', 'top', 'Classic white polo shirt', 0, 'assets/clothing/top/white-polo.png', TRUE, 'unisex', 'common'),
  ('Leather Jacket', 'top', 'Cool black leather jacket', 499, 'assets/clothing/top/black-leather-jacket.png', FALSE, 'unisex', 'rare'),
  ('Red Hoodie', 'top', 'Cozy red hoodie', 399, 'assets/clothing/top/red-hoodie.png', FALSE, 'unisex', 'rare'),
  
  -- Bottoms
  ('Blue Jeans', 'bottom', 'Classic blue denim jeans', 0, 'assets/clothing/bottom/blue-jeans.png', TRUE, 'unisex', 'common'),
  ('Dress Pants', 'bottom', 'Black dress pants', 349, 'assets/clothing/bottom/black-dress-pants.png', FALSE, 'unisex', 'rare'),
  ('Cargo Shorts', 'bottom', 'Khaki cargo shorts', 299, 'assets/clothing/bottom/khaki-cargo-shorts.png', FALSE, 'unisex', 'common'),
  
  -- Shoes
  ('White Sneakers', 'shoes', 'Clean white sneakers', 0, 'assets/clothing/shoes/white-sneakers.png', TRUE, 'unisex', 'common'),
  ('Dress Shoes', 'shoes', 'Black dress shoes', 399, 'assets/clothing/shoes/black-dress-shoes.png', FALSE, 'unisex', 'rare'),
  
  -- Accessories & Extras
  ('Gold Chain', 'accessory', 'Flashy gold chain necklace', 799, 'assets/clothing/accessory/gold-chain.png', FALSE, 'unisex', 'epic'),
  ('Sunglasses', 'glasses', 'Cool black sunglasses', 299, 'assets/clothing/glasses/black-sunglasses.png', FALSE, 'unisex', 'rare'),
  ('Baseball Cap', 'hat', 'Classic black baseball cap', 349, 'assets/clothing/hat/black-baseball-cap.png', FALSE, 'unisex', 'rare')
ON CONFLICT DO NOTHING;

-- Function to equip default clothing for new users
CREATE OR REPLACE FUNCTION equip_default_clothing()
RETURNS TRIGGER AS $$
DECLARE
  v_base_gender TEXT;
BEGIN
  -- Get the gender of the selected base avatar
  SELECT gender INTO v_base_gender
  FROM base_avatars
  WHERE id = NEW.base_avatar_id;
  
  -- Give user all default clothing items
  INSERT INTO user_clothing_inventory (user_id, clothing_id)
  SELECT NEW.user_id, id FROM avatar_clothing WHERE is_default = TRUE
  ON CONFLICT DO NOTHING;
  
  -- Equip basic outfit matching gender
  INSERT INTO user_equipped_clothing (
    user_id,
    hair_id,
    top_id,
    bottom_id,
    shoes_id
  )
  SELECT 
    NEW.user_id,
    (SELECT id FROM avatar_clothing WHERE type = 'hair' AND is_default = TRUE AND (gender = v_base_gender OR gender = 'unisex') LIMIT 1),
    (SELECT id FROM avatar_clothing WHERE type = 'top' AND is_default = TRUE LIMIT 1),
    (SELECT id FROM avatar_clothing WHERE type = 'bottom' AND is_default = TRUE LIMIT 1),
    (SELECT id FROM avatar_clothing WHERE type = 'shoes' AND is_default = TRUE LIMIT 1)
  ON CONFLICT DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger when user selects their base avatar
DROP TRIGGER IF EXISTS equip_defaults_on_avatar_select ON user_avatars;
CREATE TRIGGER equip_defaults_on_avatar_select
  AFTER INSERT ON user_avatars
  FOR EACH ROW
  EXECUTE FUNCTION equip_default_clothing();

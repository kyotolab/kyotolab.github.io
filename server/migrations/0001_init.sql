CREATE TABLE soldout (
  shop_id TEXT NOT NULL,
  dish_id TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (shop_id, dish_id)
);

CREATE TABLE orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  lang TEXT NOT NULL,
  items TEXT NOT NULL,
  subtotal INTEGER NOT NULL,
  fee INTEGER NOT NULL,
  voided INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX orders_shop_time ON orders (shop_id, created_at);

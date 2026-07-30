-- Product.attributes JSON — гибкий словарь свойств товара (30 июля 2026)
--
-- Формат: { "Объём": "80ml", "Штрихкод": "8809722156116", "Материал": "хлопок" }.
-- При импорте CSV все колонки которые не мапятся в известные поля товара
-- (name/price/description/stock/sku/category/imageUrl/productUrl/oldPrice)
-- автоматически кладутся сюда. AI видит их через get_product_details.
--
-- Additive-safe: nullable, все существующие товары останутся с NULL и
-- продолжат работать. UI показывает секцию attributes только если есть данные.

ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "attributes" JSONB;

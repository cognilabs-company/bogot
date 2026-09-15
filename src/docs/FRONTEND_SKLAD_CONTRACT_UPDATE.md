# Frontend Update: Sklad Edit va Shartnoma Jarima Summasi

## 1. Sklad Kirimlarini Edit Qilish

Kirim edit endpoint:

```http
PATCH /api/warehouse/stock-entries/{id}/
PUT /api/warehouse/stock-entries/{id}/
```

Yuboriladigan fieldlar:

```json
{
  "item": "warehouse-item-uuid",
  "quantity": "15",
  "currency": "usd",
  "unit_cost": "60",
  "supplier_name": "Yetkazib beruvchi",
  "received_at": "2026-09-14T10:00:00+05:00",
  "notes": "Izoh"
}
```

Backend avtomatik hisoblaydi:

```text
total_cost = quantity * unit_cost
```

Kirim edit qilinganda mahsulot sklad qoldig'i avtomatik qayta hisoblanadi.

Masalan eski kirim `10`, yangi kirim `15` bo'lsa qoldiqqa `+5` qo'shiladi.

Agar edit natijasida sklad qoldig'i manfiy bo'lsa API `400` qaytaradi.

## 2. Sklad Sotuvlarini Edit Qilish

Sotuv edit endpoint:

```http
PATCH /api/warehouse/sales/{id}/
PUT /api/warehouse/sales/{id}/
```

Yuboriladigan fieldlar:

```json
{
  "item": "warehouse-item-uuid",
  "client": "client-uuid",
  "client_name": "Ali Valiyev",
  "client_phone": "+998901234567",
  "quantity": "4",
  "currency": "uzs",
  "unit_price": "1100000",
  "paid_amount": "3000000",
  "payment_type": "cash",
  "sold_at": "2026-09-14T10:00:00+05:00",
  "notes": "Izoh"
}
```

Backend avtomatik hisoblaydi:

```text
total_amount = quantity * unit_price
```

Sotuv edit qilinganda backend avval eski sotuvni qoldiqqa qaytaradi, keyin yangi sotuvni qoldiqdan ayiradi.

Agar yangi sotuv uchun skladda mahsulot yetmasa API `400` qaytaradi:

```json
{
  "quantity": "Skladda yetarli mahsulot yo'q."
}
```

## 3. Editdan Keyin Refetch

Kirim yoki sotuv edit success bo'lsa quyidagi API'larni refetch qilish kerak:

```text
/api/warehouse/items/
/api/warehouse/stock-entries/
/api/warehouse/sales/
/api/warehouse/stats/
```

## 4. Chakana Oldi-Sotdi Shartnomasi: Jarima Summasi

Chakana oldi-sotdi shartnoma create qilganda yangi field qo'shildi:

```json
{
  "penalty_amount": "15000000"
}
```

Endpoint:

```http
POST /api/contracts/generate/
```

`contract_type` `retail_sale` bo'lganda frontend formada `Jarima summasi` inputini ko'rsatishi kerak.

Minimal form label:

```text
Jarima summasi
```

Input numeric/text bo'lishi mumkin. Backend string sifatida qabul qiladi.

Example:

```json
{
  "contract_type": "retail_sale",
  "contract_date": "14.09.2026",
  "contract_number": "100",
  "contract_place": "Bog'ot tumani",
  "seller_organization_name": "Solar Armada",
  "seller_director_full_name": "Behzod Saidjonov",
  "buyer_full_name": "Ali Valiyev",
  "buyer_address": "Urganch",
  "products": [
    {
      "name": "Quyosh panel",
      "unit": "Dona",
      "quantity": "2",
      "model": "Jinko",
      "price": "40000000"
    }
  ],
  "total_amount": "80000000",
  "payment_method": "Naqd",
  "contract_end_date": "31.12.2026",
  "late_payment_daily_penalty_text": "1",
  "penalty_amount": "15000000"
}
```

Generated DOCX ichida jarima matni shu ko'rinishda chiqadi:

```text
1 foiz va shartnoma vaqtida puli 30 kundan ortiq kech qolsa shartnoma buzilgan hisoblanadi va 15000000 so`m jarima solinadi
```

## 5. Muhim

`penalty_amount` faqat `retail_sale` uchun ishlatiladi.

`guarantee` shartnomasi uchun bu field kerak emas.

Sklad kirim/sotuv delete avvalgidek bloklangan, faqat edit qo'shildi.

Edit audit logga yoziladi.

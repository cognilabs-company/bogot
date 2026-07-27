# Contracts API

Base URL: `/api/contracts/`

Auth: JWT bearer token.

Permissions:
- `contracts.view` is required for list/detail/download/templates.
- `contracts.manage` is required for generate.
- `developer` and `admin` can see all generated contracts.
- Other users see only contracts they generated.

## Contract Types

`GET /api/contracts/templates/`

Response:

```json
{
  "status": "success",
  "data": [
    {"key": "retail_sale", "label": "Chakana oldi-sotdi shartnomasi"},
    {"key": "guarantee", "label": "Kafillik shartnomasi"}
  ]
}
```

## Generate Contract

`POST /api/contracts/generate/`

Creates a `.docx` from the selected template, saves it in backend media storage, and returns metadata with download URL.

### Common Fields

```json
{
  "contract_type": "retail_sale",
  "contract_date": "27.07.2026",
  "contract_number": "77",
  "contract_place": "Bog'ot tumani",
  "title": "Shartnoma 77",
  "primary_party_name": "Ali Valiyev"
}
```

Required for both types:
- `contract_type`
- `contract_date`
- `contract_number`
- `contract_place`

Optional:
- `title`
- `primary_party_name`

## Retail Sale Contract

`contract_type`: `retail_sale`

Required fields:
- `seller_organization_name`
- `seller_director_full_name`
- `buyer_full_name`
- `buyer_address`
- `total_amount`
- `payment_method`
- `contract_end_date`
- `products` or `product_name`

Recommended fields:
- `seller_director_position`
- `seller_address`
- `seller_bank_account`
- `seller_tax_id`
- `seller_mfo`
- `seller_oked`
- `buyer_passport_issuer`
- `buyer_passport_issued_date`
- `buyer_passport_series_number`
- `buyer_tax_id`
- `payment_due_text`
- `delivery_days`
- `exchange_days`
- `inspection_days`
- `delivery_penalty_percent`
- `delivery_penalty_max_percent`
- `quality_penalty_percent`
- `late_payment_daily_penalty_text`
- `late_payment_penalty_max_percent`

Example:

```json
{
  "contract_type": "retail_sale",
  "contract_date": "27.07.2026",
  "contract_number": "77",
  "contract_place": "Bog'ot tumani",
  "seller_organization_name": "Solar Armada",
  "seller_director_position": "Direktor",
  "seller_director_full_name": "Behzod Saidjonov",
  "seller_address": "Xorazm viloyati, Bog'ot tumani",
  "seller_bank_account": "-",
  "seller_tax_id": "-",
  "seller_mfo": "-",
  "seller_oked": "-",
  "buyer_full_name": "Ali Valiyev",
  "buyer_address": "Urganch tumani",
  "buyer_passport_issuer": "Urganch tumani IIB",
  "buyer_passport_issued_date": "01.01.2025",
  "buyer_passport_series_number": "AD1234567",
  "buyer_tax_id": "123456789",
  "products": [
    {
      "name": "Quyosh panel",
      "unit": "Dona",
      "quantity": "1",
      "model": "Jinko",
      "price": "40000000"
    }
  ],
  "total_amount": "40000000",
  "payment_method": "Naqd",
  "payment_due_text": "3 bank kuni",
  "delivery_days": "15 kun",
  "exchange_days": "5",
  "inspection_days": "5",
  "delivery_penalty_percent": "1",
  "delivery_penalty_max_percent": "10",
  "quality_penalty_percent": "5",
  "late_payment_daily_penalty_text": "1",
  "late_payment_penalty_max_percent": "50",
  "contract_end_date": "31.12.2026"
}
```

## Guarantee Contract

`contract_type`: `guarantee`

Required fields:
- `creditor_full_name`
- `guarantor_full_name`
- `debtor_full_name`
- `credit_contract_number`
- `credit_purpose`
- `credit_amount`
- `credit_term`

Recommended fields:
- `creditor_representative`
- `guarantor_address`
- `debtor_address`
- `creditor_bank_account`
- `creditor_tax_id`
- `debtor_bank_account`
- `debtor_tax_id`
- `credit_interest_rate`
- `principal_repayment_terms`
- `interest_repayment_terms`
- `other_terms`

Example:

```json
{
  "contract_type": "guarantee",
  "contract_date": "27.07.2026",
  "contract_number": "78",
  "contract_place": "Bog'ot",
  "creditor_full_name": "Solar Armada",
  "creditor_representative": "Behzod Saidjonov",
  "guarantor_full_name": "Vali Kafil",
  "guarantor_address": "Xiva tumani",
  "debtor_full_name": "Ali Qarzdor",
  "debtor_address": "Urganch tumani",
  "credit_contract_number": "99",
  "credit_purpose": "Quyosh panel olish",
  "credit_amount": "50000000",
  "credit_term": "12 oy",
  "credit_interest_rate": "-",
  "principal_repayment_terms": "12 oy",
  "interest_repayment_terms": "12 oy",
  "other_terms": "Kelishuv asosida"
}
```

## Generate Response

```json
{
  "status": "success",
  "data": {
    "id": "uuid",
    "contract_type": "retail_sale",
    "contract_number": "77",
    "title": "Chakana oldi-sotdi",
    "primary_party_name": "Ali Valiyev",
    "file_url": "https://api.example.com/media/contracts/retail_sale/file.docx",
    "download_url": "https://api.example.com/api/contracts/uuid/download/",
    "payload": {},
    "created_by": "uuid",
    "created_by_username": "admin",
    "created_at": "2026-07-27T16:00:00+05:00"
  }
}
```

## List Contracts

`GET /api/contracts/?contract_type=retail_sale&search=Ali&ordering=-created_at`

Supported filters:
- `contract_type`
- `contract_number`
- `created_by`

Supported search:
- `title`
- `primary_party_name`
- `contract_number`

Supported ordering:
- `created_at`
- `contract_number`
- `title`
- `primary_party_name`

## Download Contract

`GET /api/contracts/{id}/download/`

Response is binary `.docx`.

Frontend download example:

```js
const response = await fetch(`/api/contracts/${id}/download/`, {
  headers: { Authorization: `Bearer ${token}` }
});
const blob = await response.blob();
const url = URL.createObjectURL(blob);
const link = document.createElement("a");
link.href = url;
link.download = "contract.docx";
link.click();
URL.revokeObjectURL(url);
```

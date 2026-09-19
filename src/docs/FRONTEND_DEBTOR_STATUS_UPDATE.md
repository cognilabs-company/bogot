# Frontend Update: Qarzdor Statuslari

Qarzdorlarga yangi status qo'shildi:

```text
active - Aktiv
sud - Sud
mib - MIB
```

## Qarzdor Create/Edit

Endpointlar:

```http
POST /api/clients/debtors/
PATCH /api/clients/debtors/{id}/
PUT /api/clients/debtors/{id}/
```

Yangi field:

```json
{
  "status": "sud"
}
```

Default qiymat:

```text
active
```

Frontend formda status select qo'shish kerak:

```json
[
  { "value": "active", "label": "Aktiv" },
  { "value": "sud", "label": "Sud" },
  { "value": "mib", "label": "MIB" }
]
```

## Qarzdor List

List response ichida har bir qarzdorda `status` keladi:

```json
{
  "id": "...",
  "full_name": "Ali Valiyev",
  "status": "sud"
}
```

Status bo'yicha filter:

```http
GET /api/clients/debtors/?status=sud
GET /api/clients/debtors/?status=mib
GET /api/clients/debtors/?status=active
```

## Page Tepasidagi Cardlar

Yangi stats endpoint:

```http
GET /api/clients/debtors/stats/
```

Response:

```json
{
  "status": "success",
  "data": {
    "total": 120,
    "active_count": 100,
    "sud_count": 12,
    "mib_count": 8
  }
}
```

Qarzdorlar page tepasida kamida shu ikkita card chiqishi kerak:

```text
Sud: data.sud_count
MIB: data.mib_count
```

Agar umumiy son ham kerak bo'lsa:

```text
Jami: data.total
Aktiv: data.active_count
```

## Filterlar Bilan Ishlash

`/api/clients/debtors/stats/` endpoint listdagi filterlarni ham qabul qiladi.

Masalan:

```http
GET /api/clients/debtors/stats/?district=Bog'ot
GET /api/clients/debtors/stats/?debtor_type=solar_panel
```

Frontendda listga qaysi filter berilsa, statsga ham o'sha filterlarni berish mumkin.

## Excel Export

Qarzdorlar Excel export ichiga `Status` column qo'shildi.

Status bo'yicha export:

```http
GET /api/clients/debtors/export/excel/?status=sud
GET /api/clients/debtors/export/excel/?status=mib
```

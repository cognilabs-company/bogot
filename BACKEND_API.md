# Backend requirements: debtor / client totals and server-side filters

**Why:** the Debtors page (`/debtors`) shows totals, tab counts and district/mahalla groups.
The backend does not return these numbers yet, so the frontend downloads **every debtor**
(100 per request, ~10 requests per 1,000 debtors) and adds them up in the browser.
That is slow, and it gets slower as data grows.

When the backend returns the fields below, the frontend stops downloading the full list
and only requests one page of 50 rows at a time.

Sections 1 and 2 are **already supported by the frontend**. It switches over automatically
as soon as `GET /api/clients/debtors/stats/` returns a `balance_counts` object, so no
frontend release is needed for them. Sections 3–6 need a small frontend change after the
backend is ready.

---

## Business rules (how the frontend calculates today)

Please use the same rules on the backend, so the numbers do not change after the switch.

| Term | Rule |
|---|---|
| remaining debt | `remaining_debt_amount`, or `debt_amount - total_paid_amount` if it is missing |
| overdue debtor | `repayment_due_date < today` **and** remaining debt `> 0` |
| overdue amount | sum of remaining debt of overdue debtors |
| open ("Qoldiq bor") | remaining debt `> 0` |
| closed ("Yopilgan") | remaining debt `= 0` |
| recall ("Qo'ng'iroq") | `recall_at IS NOT NULL` |
| district / mahalla | `district` / `neighborhood` fields of the debtor |

---

## 1. `GET /api/clients/debtors/stats/` — add fields

It already returns `total`, `active_count`, `sud_count`, `mib_count`. Keep those. Add:

```json
{
  "total": 1000,
  "active_count": 700,
  "sud_count": 200,
  "mib_count": 100,

  "total_debt_amount": "400000000.00",
  "overdue_amount": "100000000.00",
  "credit_count": 1000,
  "district_count": 12,

  "balance_counts": {
    "all": 1000,
    "open": 800,
    "overdue": 200,
    "closed": 200,
    "recall": 12
  }
}
```

| Field | Shown on the page as | Meaning |
|---|---|---|
| `total_debt_amount` | "Jami qarzdorlik" card | sum of remaining debt |
| `overdue_amount` | "Muddati o'tgan" card | sum of remaining debt of overdue debtors |
| `credit_count` | "Kredit mijozlar" card | number of credit debtors (today every debtor counts as credit) |
| `district_count` | "Tumanlar" card | number of distinct non-empty districts |
| `balance_counts.*` | the 5 tabs above the list | counts by the rules in the table above |

Money values: decimal strings or numbers, both are accepted.

**Filters.** The stats endpoint must accept the same filters as the list and apply them
to **all** fields above: `search`, `source_number`, `debtor_type`, `district`,
`neighborhood`, `date_from`, `date_to`.
Do **not** apply `status` (active/sud/mib) or `balance_status` to the stats, because the
cards are used to switch between those values.

## 2. `GET /api/clients/debtors/` — new list filters

| Param | Values | Used by |
|---|---|---|
| `balance_status` | `open`, `overdue`, `closed` | the "Qoldiq bor / Muddati o'tgan / Yopilgan" tabs |
| `has_recall` | `true` | the "Qo'ng'iroq" tab |
| `date_from`, `date_to` | `YYYY-MM-DD` | date range pickers (not in the OpenAPI schema yet) |

Already supported and used: `page`, `page_size`, `search`, `source_number`,
`debtor_type`, `status`, `district`, `neighborhood`, `ordering`.
Please confirm `page_size=50` is allowed and `count` is the total for the filters.

## 3. Grouped view (district → mahalla) — new endpoint

The "Tuman/mahalla" view shows each district and mahalla with a debtor count, remaining
debt and overdue debt. Today the frontend downloads every debtor to build it.

`GET /api/clients/debtors/groups/` — same filters as the list (including `status` and
`balance_status`):

```json
{
  "districts": [
    {
      "district": "Chilonzor",
      "count": 500,
      "total_debt_amount": "200000000.00",
      "overdue_amount": "100000000.00",
      "neighborhoods": [
        { "neighborhood": "Bunyodkor", "count": 167, "total_debt_amount": "67000000.00", "overdue_amount": "33000000.00" }
      ]
    }
  ],
  "no_district": { "count": 3, "total_debt_amount": "0.00", "overdue_amount": "0.00" }
}
```

Debtors inside a group are then loaded with the normal list:
`/api/clients/debtors/?district=Chilonzor&neighborhood=Bunyodkor&page=1&page_size=50`.
For the "no mahalla" group we need a way to filter empty values, e.g. `neighborhood=__empty__`.

## 4. `GET /api/clients/` — filters missing from the schema

The Clients page sends these filters, but they are not in the OpenAPI schema. If the
backend ignores them, the filters only work on the 50 rows on screen:

| Param | Meaning |
|---|---|
| `district` | district name |
| `neighborhood` | neighborhood name |
| `status` | client status id |
| `created_at_after`, `created_at_before` | `YYYY-MM-DD`, inclusive |

## 5. `GET /api/clients/statuses/` — client count per status

The "Statuslar" tab on the Clients page shows how many clients have each status. Today it
only counts the 50 clients on the current page, so the numbers are wrong.
Please add `clients_count` to each status object.

## 6. `GET /api/dashboard/overview/`

- **Speed.** It takes **5–7 seconds** on the live server (measured on an empty account).
  This is the biggest single delay in the app. Please profile it (N+1 queries,
  missing indexes, Python-side loops). Target: under 500 ms.
- **Date filter.** Accept `date_from` / `date_to` and return `total_clients`,
  `total_debtors`, `overdue_amount` for that range. Today the dashboard downloads every
  debtor to compute these when a date range is picked.

---

## Full prompt for the backend developer

> We are removing client-side aggregation from the Bogot Armada CRM frontend. Today the
> Debtors page downloads every debtor (`/api/clients/debtors/`, 100 per request) only to
> compute totals, tab counts and district/mahalla groups in the browser. Please move these
> calculations to the backend (Django/DRF), using database aggregation
> (`Sum`, `Count`, `Case/When`, `values().annotate()`), not Python loops.
>
> **Business rules:**
> remaining debt = `remaining_debt_amount` (or `debt_amount - total_paid_amount`);
> overdue = `repayment_due_date < today` and remaining debt > 0;
> overdue amount = sum of remaining debt of overdue debtors;
> open = remaining debt > 0; closed = remaining debt = 0; recall = `recall_at IS NOT NULL`.
>
> **Tasks:**
> 1. `GET /api/clients/debtors/stats/`: keep `total`, `active_count`, `sud_count`,
>    `mib_count`, and add `total_debt_amount`, `overdue_amount`, `credit_count`,
>    `district_count`, and `balance_counts: {all, open, overdue, closed, recall}`.
>    Accept and apply `search`, `source_number`, `debtor_type`, `district`,
>    `neighborhood`, `date_from`, `date_to` to every field. Do not apply `status`.
> 2. `GET /api/clients/debtors/`: add filters `balance_status=open|overdue|closed`,
>    `has_recall=true`, `date_from`, `date_to` (YYYY-MM-DD, inclusive). Make sure
>    `page_size=50` works and `count` is the filtered total.
> 3. New `GET /api/clients/debtors/groups/`: same filters as the list; returns districts,
>    each with `count`, `total_debt_amount`, `overdue_amount` and a `neighborhoods` array
>    with the same three fields, plus a `no_district` bucket. Support
>    `neighborhood=__empty__` on the list to page through debtors without a mahalla.
> 4. `GET /api/clients/`: add filters `district`, `neighborhood`, `status` (status id),
>    `created_at_after`, `created_at_before`, and document them in the OpenAPI schema.
> 5. `GET /api/clients/statuses/`: add `clients_count` to each status.
> 6. `GET /api/dashboard/overview/`: profile and fix the 5–7 s response time
>    (target < 500 ms); accept `date_from` / `date_to` and return `total_clients`,
>    `total_debtors`, `overdue_amount` for that range.
>
> **Requirements:** keep all existing fields and parameters backward compatible; add
> the new parameters to the OpenAPI schema (`/api/schema/`); add DB indexes for
> `district`, `neighborhood`, `repayment_due_date`, `recall_at`, `status`, `debtor_type`
> if missing; write tests that check the stats numbers equal the counts of the
> filtered list. The exact JSON shapes are in `BACKEND_API.md`.
>
> **Done when:** with 10,000 debtors, `stats/` and `groups/` respond in under 300 ms,
> and every number on the Debtors page matches the list filtered the same way.

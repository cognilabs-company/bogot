/* pages/contracts.jsx - Contracts generation and management */
const { useState: cnS, useMemo: cnM, useEffect: cnE, useRef: cnR } = React;

const CON_UI = {
  uz: {
    title: "Shartnomalar", desc: "Shartnomalar yaratish va boshqarish",
    newContract: "Yangi shartnoma", generateTitle: "Shartnoma yaratish",
    typeRetailSale: "Chakana oldi-sotdi", typeGuarantee: "Kafillik",
    typeRetailSaleDesc: "Mahsulot sotish shartnomasi", typeGuaranteeDesc: "Kredit kafillik shartnomasi",
    stepPickType: "Tur tanlash", stepFillForm: "Ma'lumotlar",
    contractNumber: "Shartnoma raqami", contractDate: "Shartnoma sanasi",
    contractPlace: "Shartnoma joyi", contractTitle: "Sarlavha (ixtiyoriy)",
    primaryPartyName: "Asosiy tomon (ixtiyoriy)", contractEndDate: "Shartnoma muddati",
    sectionCommon: "Asosiy ma'lumotlar", sectionSeller: "Sotuvchi",
    sectionBuyer: "Xaridor", sectionProducts: "Mahsulotlar",
    sectionPayment: "To'lov", sectionTerms: "Shartlar",
    sectionCreditor: "Kreditor", sectionGuarantor: "Kafil",
    sectionDebtor: "Qarzdor", sectionCredit: "Kredit shartlari",
    sellerOrgName: "Tashkilot nomi", sellerDirectorPos: "Direktor lavozimi",
    sellerDirectorName: "Direktor FIO", sellerAddress: "Manzil",
    sellerBankAccount: "Hisob raqam", sellerTaxId: "STIR",
    sellerMfo: "MFO", sellerOked: "OKED",
    buyerFullName: "To'liq ismi", buyerAddress: "Manzil",
    buyerPassportSeries: "Pasport seriya/raqam", buyerPassportIssuer: "Bergan tashkilot",
    buyerPassportDate: "Berilgan sana", buyerTaxId: "STIR",
    totalAmount: "Jami summa", paymentMethod: "To'lov usuli",
    paymentDueText: "To'lov muddati",
    deliveryDays: "Yetkazib berish muddati", exchangeDays: "Almashtirish (kun)",
    inspectionDays: "Tekshirish (kun)", deliveryPenaltyPct: "Kechikish jarima (%)",
    deliveryPenaltyMaxPct: "Max kechikish jarima (%)", qualityPenaltyPct: "Sifat jarima (%)",
    latePenaltyText: "To'lov jarima (kunlik, %)", latePenaltyMaxPct: "Max jarima (%)",
    productName: "Mahsulot", productUnit: "O'lchov", productQty: "Miqdori",
    productModel: "Model", productPrice: "Narx",
    addProduct: "Mahsulot qo'shish", removeProduct: "O'chirish",
    creditorFullName: "Kreditor FIO", creditorRepresentative: "Vakil",
    creditorBankAccount: "Hisob raqam", creditorTaxId: "STIR",
    guarantorFullName: "Kafil FIO", guarantorAddress: "Manzil",
    debtorFullName: "Qarzdor FIO", debtorAddress: "Manzil",
    debtorBankAccount: "Hisob raqam", debtorTaxId: "STIR",
    creditContractNum: "Kredit shartnoma raqami", creditPurpose: "Kredit maqsadi",
    creditAmount: "Kredit summasi", creditTerm: "Kredit muddati",
    creditInterestRate: "Foiz stavkasi",
    principalRepaymentTerms: "Asosiy qarz to'lash", interestRepaymentTerms: "Foiz to'lash",
    otherTerms: "Boshqa shartlar",
    generate: "Yaratish", download: "Yuklab olish", cancel: "Bekor qilish",
    back: "Orqaga", next: "Davom etish",
    noContracts: "Shartnomalar topilmadi", searchContracts: "Shartnoma qidirish...",
    filterAllTypes: "Barcha turlar",
    generated: "Shartnoma yaratildi", downloadError: "Yuklab olish xatosi",
    generating: "Yaratilmoqda...", successTitle: "Shartnoma tayyor!",
    successDesc: "Shartnoma muvaffaqiyatli yaratildi",
    required: "Majburiy maydon",
    loadError: "Shartnomalar yuklanmadi",
    downloadSuccess: "Shartnoma yuklab olindi",
    downloadTitle: "Shartnomani yuklab olish",
    downloadFormat: "Format tanlang",
    downloadDocx: "Word hujjati (.docx)",
    downloadPdf: "PDF hujjat (.pdf)",
    formatNotAvail: "Format mavjud emas",
    penaltyAmount: "Jarima summasi",
    penaltyAmountDesc: "To'lov 30 kundan ortiq kechiksa solinadigan jarima",
    penaltyPreview: "Hujjatda",
    som: "so'm",
  },
  ru: {
    title: "Контракты", desc: "Создание и управление договорами",
    newContract: "Новый контракт", generateTitle: "Создать контракт",
    typeRetailSale: "Розничная продажа", typeGuarantee: "Поручительство",
    typeRetailSaleDesc: "Договор розничной купли-продажи", typeGuaranteeDesc: "Договор поручительства",
    stepPickType: "Выбор типа", stepFillForm: "Данные",
    contractNumber: "Номер договора", contractDate: "Дата договора",
    contractPlace: "Место заключения", contractTitle: "Заголовок (необяз.)",
    primaryPartyName: "Основная сторона (необяз.)", contractEndDate: "Срок действия",
    sectionCommon: "Основные данные", sectionSeller: "Продавец",
    sectionBuyer: "Покупатель", sectionProducts: "Товары",
    sectionPayment: "Оплата", sectionTerms: "Условия",
    sectionCreditor: "Кредитор", sectionGuarantor: "Поручитель",
    sectionDebtor: "Должник", sectionCredit: "Условия кредита",
    sellerOrgName: "Название организации", sellerDirectorPos: "Должность директора",
    sellerDirectorName: "ФИО директора", sellerAddress: "Адрес",
    sellerBankAccount: "Расчётный счёт", sellerTaxId: "ИНН",
    sellerMfo: "МФО", sellerOked: "ОКЭД",
    buyerFullName: "Полное имя", buyerAddress: "Адрес",
    buyerPassportSeries: "Серия/номер паспорта", buyerPassportIssuer: "Орган выдачи",
    buyerPassportDate: "Дата выдачи", buyerTaxId: "ИНН",
    totalAmount: "Общая сумма", paymentMethod: "Способ оплаты",
    paymentDueText: "Срок оплаты",
    deliveryDays: "Срок поставки", exchangeDays: "Срок обмена (дни)",
    inspectionDays: "Срок проверки (дни)", deliveryPenaltyPct: "Штраф за просрочку (%)",
    deliveryPenaltyMaxPct: "Макс. штраф (%)", qualityPenaltyPct: "Штраф за качество (%)",
    latePenaltyText: "Штраф за неоплату (день, %)", latePenaltyMaxPct: "Макс. штраф (%)",
    productName: "Товар", productUnit: "Ед. изм.", productQty: "Кол-во",
    productModel: "Модель", productPrice: "Цена",
    addProduct: "Добавить товар", removeProduct: "Удалить",
    creditorFullName: "ФИО кредитора", creditorRepresentative: "Представитель",
    creditorBankAccount: "Расчётный счёт", creditorTaxId: "ИНН",
    guarantorFullName: "ФИО поручителя", guarantorAddress: "Адрес",
    debtorFullName: "ФИО должника", debtorAddress: "Адрес",
    debtorBankAccount: "Расчётный счёт", debtorTaxId: "ИНН",
    creditContractNum: "Номер кредитного договора", creditPurpose: "Цель кредита",
    creditAmount: "Сумма кредита", creditTerm: "Срок кредита",
    creditInterestRate: "Процентная ставка",
    principalRepaymentTerms: "Погашение основного долга", interestRepaymentTerms: "Выплата процентов",
    otherTerms: "Прочие условия",
    generate: "Создать", download: "Скачать", cancel: "Отмена",
    back: "Назад", next: "Далее",
    noContracts: "Контракты не найдены", searchContracts: "Поиск контрактов...",
    filterAllTypes: "Все типы",
    generated: "Контракт создан", downloadError: "Ошибка загрузки",
    generating: "Создаётся...", successTitle: "Контракт готов!",
    successDesc: "Контракт успешно создан",
    required: "Обязательное поле",
    loadError: "Ошибка загрузки контрактов",
    downloadSuccess: "Контракт скачан",
    downloadTitle: "Скачать контракт",
    downloadFormat: "Выберите формат",
    downloadDocx: "Документ Word (.docx)",
    downloadPdf: "PDF документ (.pdf)",
    formatNotAvail: "Формат недоступен",
    penaltyAmount: "Сумма штрафа",
    penaltyAmountDesc: "Штраф, если оплата просрочена более чем на 30 дней",
    penaltyPreview: "В документе",
    som: "сум",
  },
  en: {
    title: "Contracts", desc: "Create and manage contracts",
    newContract: "New contract", generateTitle: "Generate contract",
    typeRetailSale: "Retail sale", typeGuarantee: "Guarantee",
    typeRetailSaleDesc: "Retail purchase/sale agreement", typeGuaranteeDesc: "Credit guarantee agreement",
    stepPickType: "Select type", stepFillForm: "Details",
    contractNumber: "Contract number", contractDate: "Contract date",
    contractPlace: "Contract place", contractTitle: "Title (optional)",
    primaryPartyName: "Primary party (optional)", contractEndDate: "Contract end date",
    sectionCommon: "Basic info", sectionSeller: "Seller",
    sectionBuyer: "Buyer", sectionProducts: "Products",
    sectionPayment: "Payment", sectionTerms: "Terms",
    sectionCreditor: "Creditor", sectionGuarantor: "Guarantor",
    sectionDebtor: "Debtor", sectionCredit: "Credit terms",
    sellerOrgName: "Organization name", sellerDirectorPos: "Director position",
    sellerDirectorName: "Director full name", sellerAddress: "Address",
    sellerBankAccount: "Bank account", sellerTaxId: "Tax ID",
    sellerMfo: "MFO", sellerOked: "OKED",
    buyerFullName: "Full name", buyerAddress: "Address",
    buyerPassportSeries: "Passport series/number", buyerPassportIssuer: "Issuing authority",
    buyerPassportDate: "Issue date", buyerTaxId: "Tax ID",
    totalAmount: "Total amount", paymentMethod: "Payment method",
    paymentDueText: "Payment due",
    deliveryDays: "Delivery period", exchangeDays: "Exchange period (days)",
    inspectionDays: "Inspection period (days)", deliveryPenaltyPct: "Delivery penalty (%)",
    deliveryPenaltyMaxPct: "Max delivery penalty (%)", qualityPenaltyPct: "Quality penalty (%)",
    latePenaltyText: "Late payment penalty (daily, %)", latePenaltyMaxPct: "Max late penalty (%)",
    productName: "Product", productUnit: "Unit", productQty: "Qty",
    productModel: "Model", productPrice: "Price",
    addProduct: "Add product", removeProduct: "Remove",
    creditorFullName: "Creditor full name", creditorRepresentative: "Representative",
    creditorBankAccount: "Bank account", creditorTaxId: "Tax ID",
    guarantorFullName: "Guarantor full name", guarantorAddress: "Address",
    debtorFullName: "Debtor full name", debtorAddress: "Address",
    debtorBankAccount: "Bank account", debtorTaxId: "Tax ID",
    creditContractNum: "Credit contract number", creditPurpose: "Credit purpose",
    creditAmount: "Credit amount", creditTerm: "Credit term",
    creditInterestRate: "Interest rate",
    principalRepaymentTerms: "Principal repayment terms", interestRepaymentTerms: "Interest repayment terms",
    otherTerms: "Other terms",
    generate: "Generate", download: "Download", cancel: "Cancel",
    back: "Back", next: "Next",
    noContracts: "No contracts found", searchContracts: "Search contracts...",
    filterAllTypes: "All types",
    generated: "Contract generated", downloadError: "Download error",
    generating: "Generating...", successTitle: "Contract ready!",
    successDesc: "Contract generated successfully",
    required: "Required field",
    loadError: "Failed to load contracts",
    downloadSuccess: "Contract downloaded",
    downloadTitle: "Download contract",
    downloadFormat: "Choose format",
    downloadDocx: "Word document (.docx)",
    downloadPdf: "PDF document (.pdf)",
    formatNotAvail: "Format not available",
    penaltyAmount: "Penalty amount",
    penaltyAmountDesc: "Charged if payment is more than 30 days late",
    penaltyPreview: "In document",
    som: "UZS",
  },
};

function cnLang() { return window.__TG_LANG || "uz"; }
function cnTx(key) { return CON_UI[cnLang()]?.[key] || CON_UI.uz[key] || key; }

function toApiDate(isoDate) {
  if (!isoDate) return "";
  const parts = isoDate.slice(0, 10).split("-");
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

function fmtContractDate(value) {
  if (!value) return "—";
  if (value.includes("T")) {
    const d = new Date(value);
    if (isNaN(d.getTime())) return value;
    const pad = n => String(n).padStart(2, "0");
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
  }
  return value;
}

function ContractTypeBadge({ type }) {
  const color = type === "retail_sale" ? "blue" : "violet";
  const label = type === "retail_sale" ? cnTx("typeRetailSale") : cnTx("typeGuarantee");
  return <Badge color={color}>{label}</Badge>;
}

function FormSection({ label, children }) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ height: 1, flex: 1, background: "var(--border)" }} />
        <span style={{
          fontSize: 11, fontWeight: 700, letterSpacing: ".12em",
          textTransform: "uppercase", color: "var(--text-3)", whiteSpace: "nowrap",
        }}>{label}</span>
        <div style={{ height: 1, flex: 1, background: "var(--border)" }} />
      </div>
      {children}
    </div>
  );
}

function todayIso() {
  const d = new Date();
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function blankRetail() {
  return {
    contract_number: "", contract_date: todayIso(), contract_place: "Bog'ot tumani",
    title: "", primary_party_name: "",
    seller_organization_name: "Solar Armada", seller_director_position: "Direktor",
    seller_director_full_name: "", seller_address: "Xorazm viloyati, Bog'ot tumani",
    seller_bank_account: "-", seller_tax_id: "-", seller_mfo: "-", seller_oked: "-",
    buyer_full_name: "", buyer_address: "", buyer_passport_series_number: "",
    buyer_passport_issuer: "", buyer_passport_issued_date: "", buyer_tax_id: "",
    total_amount: "", payment_method: "Naqd", payment_due_text: "3 bank kuni",
    delivery_days: "15 kun", exchange_days: "5", inspection_days: "5",
    delivery_penalty_percent: "1", delivery_penalty_max_percent: "10",
    quality_penalty_percent: "5", late_payment_daily_penalty_text: "1",
    late_payment_penalty_max_percent: "50", contract_end_date: "",
    penalty_amount: "",
    products: [{ name: "", unit: "Dona", quantity: "1", model: "", price: "" }],
  };
}

function blankGuarantee() {
  return {
    contract_number: "", contract_date: todayIso(), contract_place: "Bog'ot",
    title: "", primary_party_name: "",
    creditor_full_name: "Solar Armada", creditor_representative: "",
    creditor_bank_account: "-", creditor_tax_id: "-",
    guarantor_full_name: "", guarantor_address: "",
    debtor_full_name: "", debtor_address: "", debtor_bank_account: "-", debtor_tax_id: "-",
    credit_contract_number: "", credit_purpose: "", credit_amount: "",
    credit_term: "", credit_interest_rate: "-",
    principal_repayment_terms: "", interest_repayment_terms: "",
    other_terms: "Kelishuv asosida",
  };
}

function RetailPenaltyAmountField({ form, set }) {
  const amount = form.penalty_amount || "";
  const dailyPct = form.late_payment_daily_penalty_text || "1";
  return (
    <div className="cn-penalty">
      <div className="cn-penalty-head">
        <span className="cn-penalty-icon"><I.alert size={16} /></span>
        <div style={{ display: "grid", gap: 2 }}>
          <span className="cn-penalty-title">{cnTx("penaltyAmount")}</span>
          <span className="cn-penalty-sub">{cnTx("penaltyAmountDesc")}</span>
        </div>
      </div>
      <Field hint={amount ? `${fmtNum(amount)} ${cnTx("som")}` : null}>
        <div className="cn-penalty-input">
          <Input
            aria-label={cnTx("penaltyAmount")}
            inputMode="numeric"
            value={amount}
            onChange={e => set("penalty_amount", e.target.value.replace(/[^\d]/g, ""))}
            placeholder="15000000"
          />
          <span className="cn-penalty-suffix">{cnTx("som")}</span>
        </div>
      </Field>
      {amount && (
        <div className="cn-penalty-preview">
          <span style={{ color: "var(--text-3)" }}>{cnTx("penaltyPreview")}: </span>
          {dailyPct} foiz va shartnoma vaqtida puli 30 kundan ortiq kech qolsa shartnoma buzilgan hisoblanadi va <b>{amount} so`m</b> jarima solinadi
        </div>
      )}
    </div>
  );
}

function RetailSaleForm({ form, set, setProduct }) {
  const addProduct = () => set("products", [...form.products, { name: "", unit: "Dona", quantity: "1", model: "", price: "" }]);
  const removeProduct = (i) => set("products", form.products.filter((_, idx) => idx !== i));

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <FormSection label={cnTx("sectionCommon")}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <Field label={cnTx("contractNumber")} required><Input value={form.contract_number} onChange={e => set("contract_number", e.target.value)} placeholder="77" /></Field>
          <Field label={cnTx("contractDate")} required><DatePickerInput value={form.contract_date} onChange={v => set("contract_date", v)} /></Field>
          <Field label={cnTx("contractPlace")} required><Input value={form.contract_place} onChange={e => set("contract_place", e.target.value)} /></Field>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label={cnTx("contractTitle")}><Input value={form.title} onChange={e => set("title", e.target.value)} /></Field>
          <Field label={cnTx("primaryPartyName")}><Input value={form.primary_party_name} onChange={e => set("primary_party_name", e.target.value)} /></Field>
        </div>
      </FormSection>

      <FormSection label={cnTx("sectionSeller")}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label={cnTx("sellerOrgName")} required><Input value={form.seller_organization_name} onChange={e => set("seller_organization_name", e.target.value)} /></Field>
          <Field label={cnTx("sellerDirectorName")} required><Input value={form.seller_director_full_name} onChange={e => set("seller_director_full_name", e.target.value)} /></Field>
          <Field label={cnTx("sellerDirectorPos")}><Input value={form.seller_director_position} onChange={e => set("seller_director_position", e.target.value)} /></Field>
          <Field label={cnTx("sellerAddress")}><Input value={form.seller_address} onChange={e => set("seller_address", e.target.value)} /></Field>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
          <Field label={cnTx("sellerBankAccount")}><Input value={form.seller_bank_account} onChange={e => set("seller_bank_account", e.target.value)} /></Field>
          <Field label={cnTx("sellerTaxId")}><Input value={form.seller_tax_id} onChange={e => set("seller_tax_id", e.target.value)} /></Field>
          <Field label={cnTx("sellerMfo")}><Input value={form.seller_mfo} onChange={e => set("seller_mfo", e.target.value)} /></Field>
          <Field label={cnTx("sellerOked")}><Input value={form.seller_oked} onChange={e => set("seller_oked", e.target.value)} /></Field>
        </div>
      </FormSection>

      <FormSection label={cnTx("sectionBuyer")}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label={cnTx("buyerFullName")} required><Input value={form.buyer_full_name} onChange={e => set("buyer_full_name", e.target.value)} /></Field>
          <Field label={cnTx("buyerAddress")} required><Input value={form.buyer_address} onChange={e => set("buyer_address", e.target.value)} /></Field>
          <Field label={cnTx("buyerPassportSeries")}><Input value={form.buyer_passport_series_number} onChange={e => set("buyer_passport_series_number", e.target.value)} placeholder="AD1234567" /></Field>
          <Field label={cnTx("buyerPassportIssuer")}><Input value={form.buyer_passport_issuer} onChange={e => set("buyer_passport_issuer", e.target.value)} /></Field>
          <Field label={cnTx("buyerPassportDate")}><DatePickerInput value={form.buyer_passport_issued_date} onChange={v => set("buyer_passport_issued_date", v)} /></Field>
          <Field label={cnTx("buyerTaxId")}><Input value={form.buyer_tax_id} onChange={e => set("buyer_tax_id", e.target.value)} /></Field>
        </div>
      </FormSection>

      <FormSection label={cnTx("sectionProducts")}>
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr auto", gap: 8, padding: "6px 8px", background: "var(--surface-2)", borderRadius: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: ".08em" }}>{cnTx("productName")}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: ".08em" }}>{cnTx("productUnit")}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: ".08em" }}>{cnTx("productQty")}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: ".08em" }}>{cnTx("productModel")}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: ".08em" }}>{cnTx("productPrice")}</span>
            <span />
          </div>
          {form.products.map((p, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr auto", gap: 8, alignItems: "center" }}>
              <Input value={p.name} onChange={e => setProduct(i, "name", e.target.value)} placeholder={cnTx("productName")} />
              <Input value={p.unit} onChange={e => setProduct(i, "unit", e.target.value)} placeholder="Dona" />
              <Input type="number" value={p.quantity} onChange={e => setProduct(i, "quantity", e.target.value)} placeholder="1" />
              <Input value={p.model} onChange={e => setProduct(i, "model", e.target.value)} placeholder="Jinko" />
              <Input value={p.price} onChange={e => setProduct(i, "price", e.target.value)} placeholder="0" />
              <IconButton
                icon={<I.x size={15} />}
                label={cnTx("removeProduct")}
                onClick={() => removeProduct(i)}
                style={{ opacity: form.products.length === 1 ? 0.3 : 1 }}
                disabled={form.products.length === 1}
              />
            </div>
          ))}
          <div>
            <Button variant="ghost" size="sm" icon={<I.plus size={14} />} onClick={addProduct}>
              {cnTx("addProduct")}
            </Button>
          </div>
        </div>
      </FormSection>

      <FormSection label={cnTx("sectionPayment")}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
          <Field label={cnTx("totalAmount")} required><Input value={form.total_amount} onChange={e => set("total_amount", e.target.value)} placeholder="40000000" /></Field>
          <Field label={cnTx("paymentMethod")} required><Input value={form.payment_method} onChange={e => set("payment_method", e.target.value)} placeholder="Naqd" /></Field>
          <Field label={cnTx("paymentDueText")}><Input value={form.payment_due_text} onChange={e => set("payment_due_text", e.target.value)} placeholder="3 bank kuni" /></Field>
          <Field label={cnTx("contractEndDate")} required><DatePickerInput value={form.contract_end_date} onChange={v => set("contract_end_date", v)} /></Field>
        </div>
      </FormSection>

      <FormSection label={cnTx("sectionTerms")}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
          <Field label={cnTx("deliveryDays")}><Input value={form.delivery_days} onChange={e => set("delivery_days", e.target.value)} placeholder="15 kun" /></Field>
          <Field label={cnTx("exchangeDays")}><Input value={form.exchange_days} onChange={e => set("exchange_days", e.target.value)} placeholder="5" /></Field>
          <Field label={cnTx("inspectionDays")}><Input value={form.inspection_days} onChange={e => set("inspection_days", e.target.value)} placeholder="5" /></Field>
          <Field label={cnTx("qualityPenaltyPct")}><Input value={form.quality_penalty_percent} onChange={e => set("quality_penalty_percent", e.target.value)} placeholder="5" /></Field>
          <Field label={cnTx("deliveryPenaltyPct")}><Input value={form.delivery_penalty_percent} onChange={e => set("delivery_penalty_percent", e.target.value)} placeholder="1" /></Field>
          <Field label={cnTx("deliveryPenaltyMaxPct")}><Input value={form.delivery_penalty_max_percent} onChange={e => set("delivery_penalty_max_percent", e.target.value)} placeholder="10" /></Field>
          <Field label={cnTx("latePenaltyText")}><Input value={form.late_payment_daily_penalty_text} onChange={e => set("late_payment_daily_penalty_text", e.target.value)} placeholder="1" /></Field>
          <Field label={cnTx("latePenaltyMaxPct")}><Input value={form.late_payment_penalty_max_percent} onChange={e => set("late_payment_penalty_max_percent", e.target.value)} placeholder="50" /></Field>
        </div>
        <RetailPenaltyAmountField form={form} set={set} />
      </FormSection>
    </div>
  );
}

function GuaranteeForm({ form, set }) {
  return (
    <div style={{ display: "grid", gap: 20 }}>
      <FormSection label={cnTx("sectionCommon")}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <Field label={cnTx("contractNumber")} required><Input value={form.contract_number} onChange={e => set("contract_number", e.target.value)} placeholder="78" /></Field>
          <Field label={cnTx("contractDate")} required><DatePickerInput value={form.contract_date} onChange={v => set("contract_date", v)} /></Field>
          <Field label={cnTx("contractPlace")} required><Input value={form.contract_place} onChange={e => set("contract_place", e.target.value)} /></Field>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label={cnTx("contractTitle")}><Input value={form.title} onChange={e => set("title", e.target.value)} /></Field>
          <Field label={cnTx("primaryPartyName")}><Input value={form.primary_party_name} onChange={e => set("primary_party_name", e.target.value)} /></Field>
        </div>
      </FormSection>

      <FormSection label={cnTx("sectionCreditor")}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label={cnTx("creditorFullName")} required><Input value={form.creditor_full_name} onChange={e => set("creditor_full_name", e.target.value)} /></Field>
          <Field label={cnTx("creditorRepresentative")}><Input value={form.creditor_representative} onChange={e => set("creditor_representative", e.target.value)} /></Field>
          <Field label={cnTx("creditorBankAccount")}><Input value={form.creditor_bank_account} onChange={e => set("creditor_bank_account", e.target.value)} /></Field>
          <Field label={cnTx("creditorTaxId")}><Input value={form.creditor_tax_id} onChange={e => set("creditor_tax_id", e.target.value)} /></Field>
        </div>
      </FormSection>

      <FormSection label={cnTx("sectionGuarantor")}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label={cnTx("guarantorFullName")} required><Input value={form.guarantor_full_name} onChange={e => set("guarantor_full_name", e.target.value)} /></Field>
          <Field label={cnTx("guarantorAddress")}><Input value={form.guarantor_address} onChange={e => set("guarantor_address", e.target.value)} /></Field>
        </div>
      </FormSection>

      <FormSection label={cnTx("sectionDebtor")}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label={cnTx("debtorFullName")} required><Input value={form.debtor_full_name} onChange={e => set("debtor_full_name", e.target.value)} /></Field>
          <Field label={cnTx("debtorAddress")}><Input value={form.debtor_address} onChange={e => set("debtor_address", e.target.value)} /></Field>
          <Field label={cnTx("debtorBankAccount")}><Input value={form.debtor_bank_account} onChange={e => set("debtor_bank_account", e.target.value)} /></Field>
          <Field label={cnTx("debtorTaxId")}><Input value={form.debtor_tax_id} onChange={e => set("debtor_tax_id", e.target.value)} /></Field>
        </div>
      </FormSection>

      <FormSection label={cnTx("sectionCredit")}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label={cnTx("creditContractNum")} required><Input value={form.credit_contract_number} onChange={e => set("credit_contract_number", e.target.value)} /></Field>
          <Field label={cnTx("creditPurpose")} required><Input value={form.credit_purpose} onChange={e => set("credit_purpose", e.target.value)} /></Field>
          <Field label={cnTx("creditAmount")} required><Input value={form.credit_amount} onChange={e => set("credit_amount", e.target.value)} placeholder="50000000" /></Field>
          <Field label={cnTx("creditTerm")} required><Input value={form.credit_term} onChange={e => set("credit_term", e.target.value)} placeholder="12 oy" /></Field>
          <Field label={cnTx("creditInterestRate")}><Input value={form.credit_interest_rate} onChange={e => set("credit_interest_rate", e.target.value)} placeholder="-" /></Field>
          <Field label={cnTx("principalRepaymentTerms")}><Input value={form.principal_repayment_terms} onChange={e => set("principal_repayment_terms", e.target.value)} placeholder="12 oy" /></Field>
          <Field label={cnTx("interestRepaymentTerms")}><Input value={form.interest_repayment_terms} onChange={e => set("interest_repayment_terms", e.target.value)} placeholder="12 oy" /></Field>
          <Field label={cnTx("otherTerms")}><Input value={form.other_terms} onChange={e => set("other_terms", e.target.value)} placeholder="Kelishuv asosida" /></Field>
        </div>
      </FormSection>
    </div>
  );
}

function ContractGenerateModal({ open, onClose, onGenerated }) {
  const { toast } = useApp();
  const [step, setStep] = cnS(0);
  const [contractType, setContractType] = cnS(null);
  const [retailForm, setRetailForm] = cnS(blankRetail());
  const [guaranteeForm, setGuaranteeForm] = cnS(blankGuarantee());
  const [generating, setGenerating] = cnS(false);
  const [generated, setGenerated] = cnS(null);
  const [downloading, setDownloading] = cnS(false);

  cnE(() => {
    if (open) {
      setStep(0);
      setContractType(null);
      setRetailForm(blankRetail());
      setGuaranteeForm(blankGuarantee());
      setGenerating(false);
      setGenerated(null);
      setDownloading(false);
    }
  }, [open]);

  const setRetail = (k, v) => setRetailForm(f => ({ ...f, [k]: v }));
  const setRetailProduct = (i, k, v) => setRetailForm(f => ({
    ...f,
    products: f.products.map((p, idx) => idx === i ? { ...p, [k]: v } : p),
  }));
  const setGuarantee = (k, v) => setGuaranteeForm(f => ({ ...f, [k]: v }));

  const buildRetailPayload = () => {
    const f = retailForm;
    return {
      contract_type: "retail_sale",
      contract_number: f.contract_number,
      contract_date: toApiDate(f.contract_date),
      contract_place: f.contract_place,
      title: f.title || undefined,
      primary_party_name: f.primary_party_name || undefined,
      seller_organization_name: f.seller_organization_name,
      seller_director_position: f.seller_director_position || undefined,
      seller_director_full_name: f.seller_director_full_name,
      seller_address: f.seller_address || undefined,
      seller_bank_account: f.seller_bank_account || undefined,
      seller_tax_id: f.seller_tax_id || undefined,
      seller_mfo: f.seller_mfo || undefined,
      seller_oked: f.seller_oked || undefined,
      buyer_full_name: f.buyer_full_name,
      buyer_address: f.buyer_address,
      buyer_passport_series_number: f.buyer_passport_series_number || undefined,
      buyer_passport_issuer: f.buyer_passport_issuer || undefined,
      buyer_passport_issued_date: f.buyer_passport_issued_date ? toApiDate(f.buyer_passport_issued_date) : undefined,
      buyer_tax_id: f.buyer_tax_id || undefined,
      products: f.products.filter(p => p.name),
      total_amount: f.total_amount,
      payment_method: f.payment_method,
      payment_due_text: f.payment_due_text || undefined,
      delivery_days: f.delivery_days || undefined,
      exchange_days: f.exchange_days || undefined,
      inspection_days: f.inspection_days || undefined,
      delivery_penalty_percent: f.delivery_penalty_percent || undefined,
      delivery_penalty_max_percent: f.delivery_penalty_max_percent || undefined,
      quality_penalty_percent: f.quality_penalty_percent || undefined,
      late_payment_daily_penalty_text: f.late_payment_daily_penalty_text || undefined,
      late_payment_penalty_max_percent: f.late_payment_penalty_max_percent || undefined,
      contract_end_date: toApiDate(f.contract_end_date) || undefined,
      penalty_amount: String(f.penalty_amount || "").trim() || undefined,
    };
  };

  const buildGuaranteePayload = () => {
    const f = guaranteeForm;
    return {
      contract_type: "guarantee",
      contract_number: f.contract_number,
      contract_date: toApiDate(f.contract_date),
      contract_place: f.contract_place,
      title: f.title || undefined,
      primary_party_name: f.primary_party_name || undefined,
      creditor_full_name: f.creditor_full_name,
      creditor_representative: f.creditor_representative || undefined,
      creditor_bank_account: f.creditor_bank_account || undefined,
      creditor_tax_id: f.creditor_tax_id || undefined,
      guarantor_full_name: f.guarantor_full_name,
      guarantor_address: f.guarantor_address || undefined,
      debtor_full_name: f.debtor_full_name,
      debtor_address: f.debtor_address || undefined,
      debtor_bank_account: f.debtor_bank_account || undefined,
      debtor_tax_id: f.debtor_tax_id || undefined,
      credit_contract_number: f.credit_contract_number,
      credit_purpose: f.credit_purpose,
      credit_amount: f.credit_amount,
      credit_term: f.credit_term,
      credit_interest_rate: f.credit_interest_rate || undefined,
      principal_repayment_terms: f.principal_repayment_terms || undefined,
      interest_repayment_terms: f.interest_repayment_terms || undefined,
      other_terms: f.other_terms || undefined,
    };
  };

  const validateRetail = () => {
    const f = retailForm;
    if (!f.contract_number) return cnTx("contractNumber") + ": " + cnTx("required");
    if (!f.contract_date) return cnTx("contractDate") + ": " + cnTx("required");
    if (!f.contract_place) return cnTx("contractPlace") + ": " + cnTx("required");
    if (!f.seller_organization_name) return cnTx("sellerOrgName") + ": " + cnTx("required");
    if (!f.seller_director_full_name) return cnTx("sellerDirectorName") + ": " + cnTx("required");
    if (!f.buyer_full_name) return cnTx("buyerFullName") + ": " + cnTx("required");
    if (!f.buyer_address) return cnTx("buyerAddress") + ": " + cnTx("required");
    if (!f.total_amount) return cnTx("totalAmount") + ": " + cnTx("required");
    if (!f.payment_method) return cnTx("paymentMethod") + ": " + cnTx("required");
    return null;
  };

  const validateGuarantee = () => {
    const f = guaranteeForm;
    if (!f.contract_number) return cnTx("contractNumber") + ": " + cnTx("required");
    if (!f.contract_date) return cnTx("contractDate") + ": " + cnTx("required");
    if (!f.contract_place) return cnTx("contractPlace") + ": " + cnTx("required");
    if (!f.creditor_full_name) return cnTx("creditorFullName") + ": " + cnTx("required");
    if (!f.guarantor_full_name) return cnTx("guarantorFullName") + ": " + cnTx("required");
    if (!f.debtor_full_name) return cnTx("debtorFullName") + ": " + cnTx("required");
    if (!f.credit_contract_number) return cnTx("creditContractNum") + ": " + cnTx("required");
    if (!f.credit_purpose) return cnTx("creditPurpose") + ": " + cnTx("required");
    if (!f.credit_amount) return cnTx("creditAmount") + ": " + cnTx("required");
    if (!f.credit_term) return cnTx("creditTerm") + ": " + cnTx("required");
    return null;
  };

  const handleGenerate = async () => {
    const err = contractType === "retail_sale" ? validateRetail() : validateGuarantee();
    if (err) { toast(err, "error"); return; }
    setGenerating(true);
    try {
      const payload = contractType === "retail_sale" ? buildRetailPayload() : buildGuaranteePayload();
      const result = await apiGenerateContract(payload);
      setGenerated(result);
      toast(cnTx("generated"));
      onGenerated && onGenerated(result);
    } catch(e) { toast(e.message || "Xato", "error"); }
    finally { setGenerating(false); }
  };

  const handleDownloadFmt = async (url, filename) => {
    if (!generated) return;
    setDownloading(true);
    try {
      await apiDownloadContractFormat(url, filename);
      toast(cnTx("downloadSuccess"));
    } catch(e) { toast(e.message || cnTx("downloadError"), "error"); }
    finally { setDownloading(false); }
  };

  const typeCards = [
    {
      key: "retail_sale",
      label: cnTx("typeRetailSale"),
      desc: cnTx("typeRetailSaleDesc"),
      icon: <I.box size={22} />,
      color: "blue",
    },
    {
      key: "guarantee",
      label: cnTx("typeGuarantee"),
      desc: cnTx("typeGuaranteeDesc"),
      icon: <I.checkCircle size={22} />,
      color: "violet",
    },
  ];

  const footer = generated ? (
    <Button variant="ghost" onClick={onClose}>{cnTx("cancel")}</Button>
  ) : step === 0 ? (
    <>
      <Button variant="ghost" onClick={onClose}>{cnTx("cancel")}</Button>
      <Button
        variant="primary"
        disabled={!contractType}
        onClick={() => setStep(1)}
        iconRight={<I.chevRight size={16} />}
      >
        {cnTx("next")}
      </Button>
    </>
  ) : (
    <>
      <Button variant="ghost" icon={<I.chevLeft size={16} />} onClick={() => setStep(0)}>{cnTx("back")}</Button>
      <Button
        variant="primary"
        icon={<I.check size={16} />}
        onClick={handleGenerate}
        disabled={generating}
      >
        {generating ? cnTx("generating") : cnTx("generate")}
      </Button>
    </>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={cnTx("generateTitle")}
      icon={<I.doc size={18} />}
      width={720}
      footer={footer}
    >
      {generated ? (
        <div style={{ display: "grid", gap: 20, padding: "8px 0" }}>
          <div style={{ textAlign: "center", padding: "20px 0 8px" }}>
            <div style={{
              width: 56, height: 56, borderRadius: 999,
              background: "var(--green-bg)", color: "var(--green)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 14px",
            }}>
              <I.checkCircle size={28} />
            </div>
            <div style={{ fontSize: 20, fontWeight: 780, letterSpacing: "-.02em", marginBottom: 6 }}>{cnTx("successTitle")}</div>
            <div style={{ color: "var(--text-2)", fontSize: 14 }}>{cnTx("successDesc")}</div>
          </div>
          <div style={{ background: "var(--surface-2)", borderRadius: 14, padding: "14px 18px", display: "grid", gap: 8 }}>
            {[
              [cnTx("contractNumber"), generated.contract_number],
              [cnTx("contractTitle"), generated.title || "—"],
              [cnTx("primaryPartyName"), generated.primary_party_name || "—"],
              ["Tur", generated.contract_type === "retail_sale" ? cnTx("typeRetailSale") : cnTx("typeGuarantee")],
              ...(generated.contract_type === "retail_sale" && generated.payload?.penalty_amount
                ? [[cnTx("penaltyAmount"), `${fmtNum(generated.payload.penalty_amount)} ${cnTx("som")}`]]
                : []),
            ].map(([label, val]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 13, color: "var(--text-3)" }}>{label}</span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{val}</span>
              </div>
            ))}
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 10 }}>
              {cnTx("downloadFormat")}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[
                { key: "docx", label: cnTx("downloadDocx"), url: generated.download_docx_url, color: "blue", icon: <I.doc size={18} />, ext: ".docx" },
                { key: "pdf",  label: cnTx("downloadPdf"),  url: generated.download_pdf_url,  color: "red",  icon: <I.layers size={18} />, ext: ".pdf" },
              ].map(fmt => {
                const avail = !!fmt.url;
                const base = `shartnoma-${generated.contract_number || generated.id}`;
                return (
                  <button
                    key={fmt.key}
                    type="button"
                    disabled={downloading || !avail}
                    onClick={() => handleDownloadFmt(fmt.url, `${base}${fmt.ext}`)}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "13px 16px", borderRadius: 12,
                      border: `1.5px solid ${avail ? `var(--${fmt.color})` : "var(--border)"}`,
                      background: avail ? `var(--${fmt.color}-bg)` : "var(--surface-2)",
                      color: avail ? `var(--${fmt.color})` : "var(--text-3)",
                      cursor: avail && !downloading ? "pointer" : "not-allowed",
                      opacity: downloading ? 0.6 : 1,
                      transition: "all .15s",
                      fontWeight: 600, fontSize: 13,
                    }}
                  >
                    <div style={{
                      width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                      background: avail ? `var(--${fmt.color})` : "var(--surface-3)",
                      color: "#fff",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {downloading ? <I.refresh size={16} className="spin" /> : fmt.icon}
                    </div>
                    {fmt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : step === 0 ? (
        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 4 }}>
            {cnTx("stepPickType")}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {typeCards.map(tc => {
              const active = contractType === tc.key;
              return (
                <button
                  key={tc.key}
                  type="button"
                  onClick={() => setContractType(tc.key)}
                  style={{
                    border: active ? `2px solid var(--${tc.color})` : "2px solid var(--border)",
                    background: active ? `var(--${tc.color}-bg)` : "var(--surface-2)",
                    borderRadius: 16,
                    padding: "20px 20px",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all .15s",
                    position: "relative",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                      background: active ? `var(--${tc.color})` : "var(--surface-3)",
                      color: active ? "#fff" : `var(--${tc.color})`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      transition: "all .15s",
                    }}>
                      {tc.icon}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4, color: active ? `var(--${tc.color})` : "var(--text)" }}>
                        {tc.label}
                      </div>
                      <div style={{ fontSize: 13, color: "var(--text-3)", lineHeight: 1.5 }}>{tc.desc}</div>
                    </div>
                  </div>
                  {active && (
                    <div style={{
                      position: "absolute", top: 12, right: 12,
                      width: 20, height: 20, borderRadius: 999,
                      background: `var(--${tc.color})`, color: "#fff",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <I.check size={12} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div>
          {contractType === "retail_sale"
            ? <RetailSaleForm form={retailForm} set={setRetail} setProduct={setRetailProduct} />
            : <GuaranteeForm form={guaranteeForm} set={setGuarantee} />
          }
        </div>
      )}
    </Modal>
  );
}

function ContractDownloadModal({ open, onClose, contract }) {
  const { toast } = useApp();
  const [loadingDocx, setLoadingDocx] = cnS(false);
  const [loadingPdf, setLoadingPdf] = cnS(false);

  if (!contract) return null;

  const base = `shartnoma-${contract.contract_number || contract.id}`;

  const downloadFmt = async (url, filename, setLoading) => {
    if (!url) { toast(cnTx("formatNotAvail"), "error"); return; }
    setLoading(true);
    try {
      await apiDownloadContractFormat(url, filename);
      toast(cnTx("downloadSuccess"));
    } catch(e) { toast(e.message || cnTx("downloadError"), "error"); }
    finally { setLoading(false); }
  };

  const formats = [
    {
      key: "docx",
      label: cnTx("downloadDocx"),
      ext: ".docx",
      url: contract.download_docx_url,
      color: "blue",
      icon: <I.doc size={20} />,
      loading: loadingDocx,
      setLoading: setLoadingDocx,
    },
    {
      key: "pdf",
      label: cnTx("downloadPdf"),
      ext: ".pdf",
      url: contract.download_pdf_url,
      color: "red",
      icon: <I.layers size={20} />,
      loading: loadingPdf,
      setLoading: setLoadingPdf,
    },
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={cnTx("downloadTitle")}
      icon={<I.download size={18} />}
      width={420}
      footer={<Button variant="ghost" onClick={onClose}>{cnTx("cancel")}</Button>}
    >
      <div style={{ display: "grid", gap: 16 }}>
        <div style={{ background: "var(--surface-2)", borderRadius: 12, padding: "12px 16px", display: "grid", gap: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, color: "var(--text-3)" }}>{cnTx("contractNumber")}</span>
            <span style={{ fontWeight: 700, fontSize: 13 }}>#{contract.contract_number || "—"}</span>
          </div>
          {contract.title && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, color: "var(--text-3)" }}>{cnTx("contractTitle")}</span>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{contract.title}</span>
            </div>
          )}
          {contract.primary_party_name && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, color: "var(--text-3)" }}>{cnTx("primaryPartyName")}</span>
              <span style={{ fontSize: 13 }}>{contract.primary_party_name}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, color: "var(--text-3)" }}>Tur</span>
            <ContractTypeBadge type={contract.contract_type} />
          </div>
        </div>

        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: ".1em" }}>
          {cnTx("downloadFormat")}
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          {formats.map(fmt => {
            const avail = !!fmt.url;
            return (
              <button
                key={fmt.key}
                type="button"
                disabled={fmt.loading || !avail}
                onClick={() => downloadFmt(fmt.url, `${base}${fmt.ext}`, fmt.setLoading)}
                style={{
                  display: "flex", alignItems: "center", gap: 14,
                  padding: "14px 16px", borderRadius: 14,
                  border: `1.5px solid ${avail ? `var(--${fmt.color})` : "var(--border)"}`,
                  background: avail ? `var(--${fmt.color}-bg)` : "var(--surface-2)",
                  color: avail ? `var(--${fmt.color})` : "var(--text-3)",
                  cursor: avail ? "pointer" : "not-allowed",
                  opacity: fmt.loading ? 0.7 : 1,
                  transition: "all .15s",
                  textAlign: "left",
                  width: "100%",
                }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                  background: avail ? `var(--${fmt.color})` : "var(--surface-3)",
                  color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {fmt.loading ? <I.refresh size={18} className="spin" /> : fmt.icon}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{fmt.label}</div>
                  {!avail && (
                    <div style={{ fontSize: 12, marginTop: 2, opacity: 0.7 }}>{cnTx("formatNotAvail")}</div>
                  )}
                </div>
                {avail && !fmt.loading && (
                  <I.download size={16} style={{ marginLeft: "auto", opacity: 0.6 }} />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}

function ContractRow({ contract }) {
  const [dlOpen, setDlOpen] = cnS(false);

  return (
    <>
      <div style={{
        display: "grid",
        gridTemplateColumns: "90px 1fr 1fr auto 120px 44px",
        gap: 12,
        padding: "14px 16px",
        alignItems: "center",
        borderBottom: "1px solid var(--border)",
        background: "transparent",
        transition: "background .12s",
      }}
        onMouseEnter={e => e.currentTarget.style.background = "var(--surface-2)"}
        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
      >
        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>
          #{contract.contract_number || "—"}
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{contract.title || "—"}</div>
          {contract.primary_party_name && (
            <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>{contract.primary_party_name}</div>
          )}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-2)" }}>
          {contract.created_by_username || "—"}
        </div>
        <ContractTypeBadge type={contract.contract_type} />
        <div style={{ fontSize: 12, color: "var(--text-3)", textAlign: "right" }}>
          {fmtContractDate(contract.created_at)}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <IconButton
            icon={<I.download size={15} />}
            label={cnTx("download")}
            onClick={() => setDlOpen(true)}
          />
        </div>
      </div>
      <ContractDownloadModal open={dlOpen} onClose={() => setDlOpen(false)} contract={contract} />
    </>
  );
}

function ContractsPage() {
  const { toast } = useApp();
  const [q, setQ] = cnS("");
  const [typeFilter, setTypeFilter] = cnS("all");
  const [contracts, setContracts] = cnS([]);
  const [total, setTotal] = cnS(0);
  const [loading, setLoading] = cnS(true);
  const [generateOpen, setGenerateOpen] = cnS(false);
  const [page, setPage] = cnS(1);
  const PAGE_SIZE = 20;

  const loadContracts = async (opts = {}) => {
    setLoading(true);
    try {
      const params = {
        page: opts.page || page,
        page_size: PAGE_SIZE,
      };
      if (q) params.search = q;
      if (typeFilter !== "all") params.contract_type = typeFilter;
      params.ordering = "-created_at";
      const res = await apiListContracts(params);
      setContracts(res.results || []);
      setTotal(res.count || 0);
    } catch(e) {
      toast(e.message || cnTx("loadError"), "error");
    } finally {
      setLoading(false);
    }
  };

  cnE(() => {
    setPage(1);
    loadContracts({ page: 1 });
  }, [q, typeFilter]);

  const typeOptions = [
    { value: "retail_sale", label: cnTx("typeRetailSale") },
    { value: "guarantee", label: cnTx("typeGuarantee") },
  ];

  const showEmpty = !loading && contracts.length === 0;

  return (
    <div className="page fade-in">
      <PageHeader
        title={cnTx("title")}
        desc={cnTx("desc")}
        actions={
          <Button
            variant="primary"
            icon={<I.plus size={16} />}
            onClick={() => setGenerateOpen(true)}
          >
            {cnTx("newContract")}
          </Button>
        }
      />

      <div style={{ display: "grid", gap: 18 }}>
        <Card pad={false}>
          <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid var(--border)", flexWrap: "wrap" }}>
            <SearchInput
              value={q}
              onChange={v => setQ(v)}
              placeholder={cnTx("searchContracts")}
              width={280}
            />
            <FilterSelect
              label={cnTx("filterAllTypes")}
              icon="filter"
              value={typeFilter}
              onChange={v => setTypeFilter(v)}
              options={typeOptions}
            />
            {total > 0 && (
              <span style={{ marginLeft: "auto", fontSize: 13, color: "var(--text-3)" }}>
                {total}
              </span>
            )}
          </div>

          {loading ? (
            <SkeletonRows rows={6} cols={6} />
          ) : showEmpty ? (
            <div style={{ padding: "40px 24px" }}>
              <EmptyState
                icon={<I.doc size={26} />}
                title={cnTx("noContracts")}
                action={
                  <Button variant="primary" icon={<I.plus size={16} />} onClick={() => setGenerateOpen(true)}>
                    {cnTx("newContract")}
                  </Button>
                }
              />
            </div>
          ) : (
            <div>
              <div style={{
                display: "grid",
                gridTemplateColumns: "90px 1fr 1fr auto 120px 44px",
                gap: 12,
                padding: "10px 16px",
                borderBottom: "1px solid var(--border)",
              }}>
                {["#", cnTx("contractTitle"), "Yaratuvchi", "Tur", "Sana", ""].map((h, i) => (
                  <span key={i} style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: ".08em" }}>{h}</span>
                ))}
              </div>
              {contracts.map(c => <ContractRow key={c.id} contract={c} />)}
            </div>
          )}

          {total > PAGE_SIZE && !loading && (
            <div style={{ padding: "14px 16px", display: "flex", gap: 10, alignItems: "center", justifyContent: "center", borderTop: "1px solid var(--border)" }}>
              <Button
                variant="ghost"
                size="sm"
                icon={<I.chevLeft size={15} />}
                disabled={page <= 1}
                onClick={() => { const p = page - 1; setPage(p); loadContracts({ page: p }); }}
              >Oldingi</Button>
              <span style={{ fontSize: 13, color: "var(--text-2)" }}>{page} / {Math.ceil(total / PAGE_SIZE)}</span>
              <Button
                variant="ghost"
                size="sm"
                iconRight={<I.chevRight size={15} />}
                disabled={page >= Math.ceil(total / PAGE_SIZE)}
                onClick={() => { const p = page + 1; setPage(p); loadContracts({ page: p }); }}
              >Keyingi</Button>
            </div>
          )}
        </Card>
      </div>

      <ContractGenerateModal
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
        onGenerated={() => loadContracts({ page: 1 })}
      />
    </div>
  );
}

window.ContractsPage = ContractsPage;

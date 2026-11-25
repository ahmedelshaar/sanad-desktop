import defaultLogo from '../electron/assets/default-logo.png';

// In-memory stand-in for the Electron bridge, used only when the UI runs in a normal browser.
// Lets you work on screens and the print layout with `npx vite` without Electron.

export function createMock() {
  const ok = (data) => Promise.resolve({ ok: true, data });
  const fail = (error) => Promise.resolve({ ok: false, error });
  const pad = (seq, count) => String(seq).padStart(Math.max(2, String(count).length), '0');

  let settings = {
    ui_lang: 'ar',
    // Stamp printed at the top of the note (defaults copy the client's paper form)
    header_prefix: 'معــــرض',
    header_title: 'بن زرعه', // used when there is no logo image
    header_activity: 'لبيــع\nوشراء السيارات',
    header_owner: 'لصاحبه / عبدالله أحمد حسن العمري',
    header_license: 'ترخيص رقم ١٠٧ - س.ت ٥٨٠٦٠٠٨٥٦٦',
    header_contacts: 'هاتف : ٠١٧ ٧٢٨٢٩٦٦ - ص.ب ١٦ - جوال: ٠٥٠٣٧٨١٠٣٥ - ٠٥٠٤٥٨٨٧٢١',
    logo: defaultLogo,
    logo_seeded: '0', // set to 1 once the bundled default logo was loaded
    city: 'المخواة',
    creditor_name: 'عبدالله أحمد حسن العمري', // default "الطرف الأول"
    footer_text:
      'هذا السند واجب الدفع بموجب قرار مجلس الوزراء الموقر رقم ٦٩٣ وتاريخ ٢٦ / ٩ / ١٣٨٣ هـ\nالمتوج بالمرسوم الملكي الكريم رقم ٣٧ وتاريخ ١١ / ١٠ / ١٣٨٣ هـ ( الخاص بتنظيم الأوراق التجارية )',
    paper: 'A5',
    paper_width_mm: '148',
    paper_height_mm: '210',
    offset_x_mm: '0',
    offset_y_mm: '0',
    scale: '1',
    printer_name: '',
    silent_print: '0',
    print_digits: 'arabic',
  };
  const books = [{ id: 1, name: 'دفتر 1', count: 60, status: 'open', created_at: '2026-11-25 10:00:00' }];
  const vouchers = [
    {
      id: 1,
      book_id: 1,
      seq: 1,
      status: 'active',
      issue_date: '2026-11-25',
      due_date: '2027-05-25',
      city: 'المخواة',
      amount: 25500.5,
      amount_words: 'خمسة وعشرون ألف وخمسمائة ريال سعودي وخمسون هللة فقط لا غير',
      reason: 'سيارة تويوتا كامري موديل 2024',
      debtor_name: 'محمد عبدالله الزهراني',
      debtor_id_number: '1012345678',
      debtor_id_date: '1440/05/10',
      debtor_id_source: 'الباحة',
      debtor_address: 'المخواة - حي الملك فهد',
      creditor_name: 'عبدالله أحمد',
      guarantor_name: 'سعيد علي الغامدي',
      guarantor_id_number: '1098765432',
      guarantor_id_date: '1438/02/01',
      guarantor_id_source: 'الباحة',
      guarantor_address: 'المخواة',
      witness1: 'خالد محمد',
      witness2: 'فهد سالم',
      print_count: 0,
    },
  ];

  const bookView = (b) => {
    const list = vouchers.filter((v) => v.book_id === b.id);
    return { ...b, used: list.length, cancelled: list.filter((v) => v.status === 'cancelled').length };
  };
  const voucherView = (v) => {
    const b = books.find((x) => x.id === v.book_id);
    return { ...v, book_name: b.name, book_count: b.count, number_label: pad(v.seq, b.count) };
  };

  return {
    settings: {
      get: () => ok({ ...settings }),
      save: (vals) => ok((settings = { ...settings, ...vals })),
      pickLogo: () => ok(null),
    },
    printers: { list: () => ok([]) },
    backup: { create: () => ok(null), restore: () => ok(null) },
    books: {
      list: () => ok(books.map(bookView).reverse()),
      create: ({ name, count }) => {
        if (!name) return fail('BOOK_NAME_REQUIRED');
        const b = { id: books.length + 1, name, count: Number(count), status: 'open', created_at: new Date().toISOString() };
        books.push(b);
        return ok(bookView(b));
      },
      setStatus: (id, status) => {
        const b = books.find((x) => x.id === id);
        b.status = status;
        return ok(bookView(b));
      },
      next: (id) => {
        const b = bookView(books.find((x) => x.id === id));
        return ok({ book: b, seq: b.used + 1, label: pad(b.used + 1, b.count), full: b.used >= b.count });
      },
    },
    customers: { search: () => ok([]) },
    vouchers: {
      list: () => ok(vouchers.map(voucherView).reverse()),
      get: (id) => ok(voucherView(vouchers.find((v) => v.id === Number(id)) || vouchers[0])),
      create: (bookId, data) => {
        const b = bookView(books.find((x) => x.id === bookId));
        if (b.used >= b.count) return fail('BOOK_FULL');
        const v = { ...data, id: vouchers.length + 1, book_id: bookId, seq: b.used + 1, status: 'active', print_count: 0 };
        vouchers.push(v);
        return ok(voucherView(v));
      },
      update: (id, data) => {
        const v = vouchers.find((x) => x.id === id);
        Object.assign(v, data);
        return ok(voucherView(v));
      },
      cancel: (id) => {
        const v = vouchers.find((x) => x.id === id);
        v.status = 'cancelled';
        return ok(voucherView(v));
      },
      print: () => {
        window.print();
        return ok({ ok: true });
      },
    },
  };
}

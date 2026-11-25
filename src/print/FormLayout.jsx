// Exact reproduction of the client's paper promissory note (سند لأمر).
//
// All coordinates are in mm, measured from a 200 dpi scan of the original Letter-size form.
// The stamp (header) is upright; the body of the form is printed sideways (rotated 90deg
// clockwise), exactly like the paper. Body coordinates (u, v) are measured on the form turned
// so the text reads normally: u = left -> right (0..279.4), v = top -> bottom (0..215.9).

import { useLayoutEffect, useRef } from 'react';

export const FORM_W = 215.9; // Letter width, mm
export const FORM_H = 279.4; // Letter height, mm

const mm = (n) => `${n}mm`;

// Scales a single line horizontally so it fills its measured box, like the original print.
function Fit({ children, mode = 'shrink', align = 'right' }) {
  const outer = useRef(null);
  const inner = useRef(null);
  useLayoutEffect(() => {
    const el = inner.current;
    const box = outer.current;
    if (!el || !box) return;
    const apply = () => {
      el.style.transform = 'none';
      const natural = el.scrollWidth;
      const target = box.clientWidth;
      if (!natural || !target) return;
      let k = target / natural;
      if (mode === 'shrink') k = Math.min(1, k);
      else k = Math.max(0.7, Math.min(1.35, k));
      el.style.transform = `scaleX(${k})`;
    };
    apply();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(apply);
  });
  const origin = align === 'left' ? 'left' : align === 'center' ? 'center' : 'right';
  return (
    <div ref={outer} className="fit" style={{ justifyContent: align === 'left' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start' }}>
      <span ref={inner} className="fit-inner" style={{ transformOrigin: `${origin} center` }}>
        {children}
      </span>
    </div>
  );
}

// Static form text. u1..u2 and v1..v2 are the measured ink box of the text on the original.
function T({ u1, u2, v1, v2, size, weight = 700, align = 'right', fit = 'both', children }) {
  return (
    <div
      className="ft"
      style={{ left: mm(u1), width: mm(u2 - u1), top: mm(v1), height: mm(v2 - v1), fontSize: size, fontWeight: weight }}
    >
      <Fit mode={fit} align={align}>
        {children}
      </Fit>
    </div>
  );
}

// Dotted fill-in line with its baseline at v.
function Dots({ u1, u2, v }) {
  return <div className="fdots" style={{ left: mm(u1), width: mm(u2 - u1), top: mm(v - 0.3) }} />;
}

// Filled-in data, sitting on the dotted line (baseline v).
function Val({ u1, u2, v, children, size = '11pt', align = 'center' }) {
  if (children == null || children === '') return null;
  return (
    <div className="fval" style={{ left: mm(u1), width: mm(u2 - u1), top: mm(v - 5.2), height: mm(5), fontSize: size }}>
      <Fit mode="shrink" align={align}>
        {children}
      </Fit>
    </div>
  );
}

// "حامل حفيظة رقم ... تاريخ ... المصدر ... العنوان ..." line, used for debtor and guarantor.
function IdLine({ v1, v2, labels, values }) {
  const base = v2 - 0.9;
  const [idL, dateL, srcL, addrL] = labels; // [u1, u2] of each label
  return (
    <>
      <T u1={idL[0]} u2={idL[1]} v1={v1} v2={v2} size="11pt">حامل حفيظة رقم</T>
      <Dots u1={dateL[1] + 0.6} u2={idL[0] - 0.6} v={base} />
      <Val u1={dateL[1] + 0.6} u2={idL[0] - 0.6} v={base}>{values.id}</Val>
      <T u1={dateL[0]} u2={dateL[1]} v1={v1} v2={v2} size="11pt">تاريخ</T>
      <Dots u1={srcL[1] + 0.6} u2={dateL[0] - 0.6} v={base} />
      <Val u1={srcL[1] + 0.6} u2={dateL[0] - 0.6} v={base}>{values.date}</Val>
      <T u1={srcL[0]} u2={srcL[1]} v1={v1} v2={v2} size="11pt">المصدر</T>
      <Dots u1={addrL[1] + 0.6} u2={srcL[0] - 0.6} v={base} />
      <Val u1={addrL[1] + 0.6} u2={srcL[0] - 0.6} v={base}>{values.source}</Val>
      <T u1={addrL[0]} u2={addrL[1]} v1={v1} v2={v2} size="11pt">العنوان</T>
      <Dots u1={66.4} u2={addrL[0] - 0.6} v={base} />
      <Val u1={66.4} u2={addrL[0] - 0.6} v={base}>{values.address}</Val>
    </>
  );
}

// The stamp at the top of the page (upright). Coordinates are page coordinates (x, y).
function Stamp({ s }) {
  const lines = (s.header_activity || '').split('\n');
  return (
    <div className="fstamp" style={{ left: mm(52.4), top: mm(23.6), width: mm(125.9), height: mm(38.5) }}>
      {/* row 1: معرض | logo | لبيع وشراء السيارات  (absolute, measured) */}
      <div className="ft" style={{ left: mm(142.6 - 52.4), width: mm(21), top: mm(29.4 - 23.6), height: mm(4.8), fontSize: '15pt', fontWeight: 800 }}>
        <Fit mode="both">{s.header_prefix}</Fit>
      </div>
      <div className="flogo" style={{ left: mm(97.4 - 52.4), width: mm(38.7), top: mm(24.8 - 23.6), height: mm(14.3) }}>
        {s.logo ? <img src={s.logo} alt="" /> : <span>{s.header_title}</span>}
      </div>
      {lines[0] ? (
        <div className="ft" style={{ left: mm(67.8 - 52.4), width: mm(27.8), top: mm(27.1 - 23.6), height: mm(4.6), fontSize: '13pt', fontWeight: 800 }}>
          <Fit mode="shrink" align="center">
            {lines[0]}
          </Fit>
        </div>
      ) : null}
      {lines[1] ? (
        <div className="ft" style={{ left: mm(67.8 - 52.4), width: mm(27.8), top: mm(32.6 - 23.6), height: mm(6.2), fontSize: '13pt', fontWeight: 800 }}>
          <Fit mode="both">{lines[1]}</Fit>
        </div>
      ) : null}
      {/* owner / license / contacts */}
      <div className="ft" style={{ left: mm(79.9 - 52.4), width: mm(76.7), top: mm(41.6 - 23.6), height: mm(5.3), fontSize: '13pt', fontWeight: 800 }}>
        <Fit mode="both" align="center">{s.header_owner}</Fit>
      </div>
      <div className="ft" style={{ left: mm(85.0 - 52.4), width: mm(60.9), top: mm(47.6 - 23.6), height: mm(4.8), fontSize: '12pt', fontWeight: 800 }}>
        <Fit mode="shrink" align="center">{s.header_license}</Fit>
      </div>
      <div className="ft" style={{ left: mm(61.0 - 52.4), width: mm(109.2), top: mm(54.1 - 23.6), height: mm(4.6), fontSize: '12pt', fontWeight: 800 }}>
        <Fit mode="both" align="center">{s.header_contacts}</Fit>
      </div>
    </div>
  );
}

/**
 * The whole form, Letter-size, with the data written in.
 * `v` holds display-ready strings (digits already converted) prepared by VoucherSheet.
 */
export function PaperForm({ s, v }) {
  const footer = (s.footer_text || '').split('\n');
  return (
    <div className="fpage" style={{ width: mm(FORM_W), height: mm(FORM_H) }}>
      <Stamp s={s} />

      <div
        className="fbody"
        style={{ width: mm(FORM_H), height: mm(FORM_W), transform: `translate(${mm(FORM_W)}, 0) rotate(90deg)` }}
      >
        {/* حرر في مدينة المخواة */}
        <T u1={118} u2={167} v1={37.4} v2={41.2} size="13pt" fit="shrink" align="center">
          حرر في مدينة {v.city}
        </T>

        {/* amount boxes */}
        <T u1={191.8} u2={203.8} v1={43.6} v2={46.4} size="10pt">ريـــال</T>
        <T u1={227.7} u2={230.1} v1={43.6} v2={46.4} size="10pt" fit="shrink">هـ</T>
        <div className="fbox" style={{ left: mm(183.1), width: mm(32.8), top: mm(47.0), height: mm(9.4) }}>
          <span>{v.riyals}</span>
        </div>
        <div className="fbox" style={{ left: mm(218.9), width: mm(12.4), top: mm(47.0), height: mm(9.4) }}>
          <span>{v.halalas}</span>
        </div>

        {/* title */}
        <T u1={132.7} u2={156.1} v1={46.6} v2={52.2} size="20pt" weight={800}>سـنـد لأمـــر</T>

        {/* number */}
        <T u1={105.3} u2={109.2} v1={46.9} v2={49.3} size="8pt">رقم</T>
        <Val u1={80} u2={104.5} v={50.6} size="11pt">{v.number}</Val>

        {/* في  /  /  ١٤ هـ  (Hijri issue date) */}
        <T u1={105.5} u2={109.2} v1={54.6} v2={57.6} size="11pt">في</T>
        <T u1={94.8} u2={96.2} v1={54.6} v2={57.4} size="11pt" fit="shrink">/</T>
        <T u1={83.0} u2={84.4} v1={54.6} v2={57.4} size="11pt" fit="shrink">/</T>
        <T u1={66.2} u2={72.3} v1={54.6} v2={57.6} size="10pt">١٤ هـ</T>
        <Val u1={96.6} u2={105} v={58.3}>{v.issueH.day}</Val>
        <Val u1={84.8} u2={94.4} v={58.3}>{v.issueH.month}</Val>
        <Val u1={72.4} u2={82.6} v={58.3} align="left">{v.issueH.yy}</Val>

        {/* أقر أنا الموقع اسمي أدناه ... الطرف الثاني */}
        <T u1={193.4} u2={229.6} v1={61.7} v2={65.7} size="11pt">أقــر أنا الموقــع اسمي أدناه</T>
        <Dots u1={83.8} u2={192.8} v={64.8} />
        <Val u1={83.8} u2={192.8} v={64.8}>{v.debtor_name}</Val>
        <T u1={65.9} u2={83.2} v1={61.7} v2={65.7} size="11pt">الطرف الثاني</T>

        <IdLine
          v1={70.4}
          v2={73.9}
          labels={[
            [206.1, 229.4],
            [172.0, 178.7],
            [134.0, 143.4],
            [97.9, 106.9],
          ]}
          values={{ id: v.debtor_id_number, date: v.debtor_id_date, source: v.debtor_id_source, address: v.debtor_address }}
        />

        {/* بأن أدفع لأمر السيد / ... الطرف الأول */}
        <T u1={201.8} u2={229.6} v1={78.6} v2={82.4} size="11pt">بأن أدفع لأمر السيد /</T>
        <Dots u1={85.4} u2={201.2} v={81.5} />
        <Val u1={85.4} u2={201.2} v={81.5}>{v.creditor_name}</Val>
        <T u1={67.6} u2={84.8} v1={78.6} v2={82.4} size="11pt">الطرف الأول</T>

        {/* المبلغ المرقوم أعلاه وقدره [box] */}
        <T u1={192.5} u2={229.5} v1={87.4} v2={90.8} size="11pt">المبلغ المرقوم أعلاه وقــدره</T>
        <div className="fbox words" style={{ left: mm(66.7), width: mm(124.8), top: mm(84.5), height: mm(8.1) }}>
          <Fit mode="shrink" align="center">{v.amount_words}</Fit>
        </div>

        {/* في موعد استحقاق هذا السند بتاريخ  /  /  ٢٠ م المبلغ المشروح أعلاه أو لوكيله */}
        <T u1={165.7} u2={229.6} v1={95.6} v2={99.4} size="11pt">فــي موعــد استحقــاق هــذه الســند بتاريــخ</T>
        <T u1={150.1} u2={151.5} v1={95.6} v2={98.8} size="11pt" fit="shrink">/</T>
        <T u1={136.3} u2={137.7} v1={95.6} v2={98.8} size="11pt" fit="shrink">/</T>
        <T u1={115.3} u2={119.9} v1={95.6} v2={98.8} size="10pt">٢٠ م</T>
        <T u1={67.9} u2={111.6} v1={95.6} v2={99.4} size="11pt">المبلــغ المشروح أعلاه أو لوكيله</T>
        <Val u1={151.9} u2={165} v={99.5}>{v.dueG.day}</Val>
        <Val u1={138.1} u2={149.7} v={99.5}>{v.dueG.month}</Val>
        <Val u1={120} u2={135.9} v={99.5} align="left">{v.dueG.yy}</Val>

        {/* وذلك من قيمة ... وان تأخرت عن دفع المبلغ فإن للطرف الأول */}
        <T u1={193.3} u2={229.6} v1={104.0} v2={108.0} size="11pt">وذلك مــن قيمـــــــة</T>
        <Dots u1={136.6} u2={192.7} v={107.1} />
        <Val u1={136.6} u2={192.7} v={107.1}>{v.reason}</Val>
        <T u1={66.3} u2={136.0} v1={104.0} v2={108.0} size="11pt">وان تأخــرت عــن دفــع المبلــغ فإن للطــرف الأول</T>

        <T u1={66.4} u2={229.4} v1={112.5} v2={116.3} size="11pt">
          الحــق فــي استيفــاء حقــوقــه بالطــريقــة التي يراها تضمــن حقوقــه وكفيلي ملــزم بســداد المبلــغ بمــوجب
        </T>
        <T u1={125.9} u2={229.5} v1={121.2} v2={124.8} size="11pt">
          تاريــخ الســـنــد الموضــح أعــلاه وأذنت لمــن يشهــد والله خــيـر الشــاهديــن .
        </T>

        {/* أقر أنا ... بأنني أكفل ... */}
        <T u1={222.0} u2={229.5} v1={129.7} v2={133.0} size="11pt">أقر أنا</T>
        <Dots u1={150.2} u2={221.4} v={132.2} />
        <Val u1={150.2} u2={221.4} v={132.2}>{v.guarantor_name}</Val>
        <T u1={133.2} u2={149.6} v1={129.7} v2={133.0} size="11pt">بأنني أكفل</T>
        <Dots u1={66.4} u2={132.6} v={132.2} />
        <Val u1={66.4} u2={132.6} v={132.2}>{v.guaranteed_name}</Val>

        <IdLine
          v1={138.2}
          v2={141.6}
          labels={[
            [206.0, 229.1],
            [170.1, 176.8],
            [133.7, 143.1],
            [98.9, 108.0],
          ]}
          values={{
            id: v.guarantor_id_number,
            date: v.guarantor_id_date,
            source: v.guarantor_id_source,
            address: v.guarantor_address,
          }}
        />

        <T u1={122.8} u2={229.4} v1={143.3} v2={146.9} size="11pt">
          فــي ســداد قيمــة الســند أو الســـنـدات اللاحقــة كفالــة غــرم وأداء وعليــه أوقــع
        </T>

        {/* signatures */}
        <T u1={184.7} u2={202.4} v1={149.2} v2={153.5} size="11pt">توقيع المدين</T>
        <T u1={158.4} u2={165.6} v1={149.2} v2={153.5} size="11pt">شاهد</T>
        <T u1={132.7} u2={139.3} v1={149.2} v2={153.5} size="11pt">شاهد</T>
        <T u1={92.7} u2={112.3} v1={149.2} v2={153.5} size="11pt">توقيع الكفيل</T>

        {/* rule + legal footer */}
        <div className="frule" style={{ left: mm(67.4), width: mm(229.6 - 67.4), top: mm(159.3) }} />
        {footer[0] ? (
          <T u1={105.5} u2={229.4} v1={161.0} v2={164.3} size="9.5pt">{footer[0]}</T>
        ) : null}
        {footer[1] ? (
          <T u1={104.1} u2={229.2} v1={164.8} v2={168.3} size="9.5pt">{footer[1]}</T>
        ) : null}

        {v.cancelled ? <div className="fvoid">ملغي</div> : null}
      </div>
    </div>
  );
}

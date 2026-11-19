import{u as M,r as T,j as e,f as $,X as L,D as l,a8 as B,n as i,P as G,aa as W,a5 as q,ab as O,ac as U}from"./index-DuSapF_x.js";import{I as X}from"./InvoiceItemMeta-cJDlF9z_.js";const J=({isOpen:S,onClose:c,invoice:t,onStartNewInvoice:o})=>{var b,f,j,u,N,y,w,g,k;const a=M(r=>r.user),P=T.useRef(null);if(!S||!t)return null;const s=a==null?void 0:a.store_identity,d=(s==null?void 0:s.business_name)||(a==null?void 0:a.store_name)||(a==null?void 0:a.name)||"متجر إنجاز برو",p=(s==null?void 0:s.store_phone)||(a==null?void 0:a.phone),x=s==null?void 0:s.store_address,n=(s==null?void 0:s.currency)||"ج.م",h=((b=t.creator)==null?void 0:b.name)||t.created_by_name||(a==null?void 0:a.name)||"كاشير",C=t.date||new Date().toISOString().split("T")[0],R=t.created_at?new Date(t.created_at).toLocaleTimeString("ar-EG",{hour:"2-digit",minute:"2-digit"}):new Date().toLocaleTimeString("ar-EG",{hour:"2-digit",minute:"2-digit"}),z=()=>{window.print()},A=async()=>{var _,v;const r=O(t,{storeName:d,storePhone:p,currencySymbol:n}),m=t.invoice_number||`#${t.id}`,D=((_=t.party)==null?void 0:_.phone)||t.customer_phone||((v=t.party)==null?void 0:v.phone);await U.shareInvoice({title:`فاتورة ${m} - ${d}`,text:r,phone:D})},E=t.items||[];return e.jsxs("div",{className:"fixed inset-0 z-50 bg-ink/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150",children:[e.jsxs("div",{className:"bg-panel rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden border border-line animate-in zoom-in-95 duration-200 flex flex-col max-h-[95vh] text-ink",children:[e.jsxs("div",{className:"p-4 bg-surface-1 border-b border-line text-ink flex items-center justify-between no-print",children:[e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx($,{className:"w-5 h-5 text-ok"}),e.jsx("h3",{className:"text-sm font-black",children:o?"تم تسجيل الفاتورة بنجاح":"معاينة وإيصال الفاتورة"})]}),e.jsx("button",{type:"button",onClick:c,className:"p-1.5 text-muted hover:text-ink rounded-lg transition-colors",children:e.jsx(L,{className:"w-4 h-4"})})]}),e.jsx("div",{className:"p-4 overflow-y-auto flex-1 bg-surface-2/50 flex justify-center",children:e.jsxs("div",{ref:P,id:"pos-thermal-receipt",className:"w-full bg-paper p-5 rounded-2xl border border-paper-line shadow-sm text-paper-ink font-sans text-xs leading-relaxed",dir:"rtl",children:[e.jsxs("div",{className:"text-center pb-3 border-b border-dashed border-paper-line space-y-1",children:[e.jsx("h2",{className:"text-base font-black tracking-tight text-paper-ink",children:d}),e.jsx("p",{className:"text-2xs text-paper-muted font-sans",children:"فاتورة مبيعات"}),p&&e.jsxs("p",{className:"text-2xs text-paper-muted font-mono",children:["هاتف: ",p]}),x&&e.jsx("p",{className:"text-2xs text-paper-muted font-sans",children:x})]}),e.jsxs("div",{className:"py-2.5 border-b border-dashed border-paper-line space-y-1 text-[11px]",children:[e.jsxs("div",{className:"flex justify-between items-center",children:[e.jsx("span",{className:"text-paper-muted",children:"رقم الفاتورة:"}),e.jsx("span",{className:"font-bold font-mono",children:t.invoice_number})]}),e.jsxs("div",{className:"flex justify-between items-center",children:[e.jsx("span",{className:"text-paper-muted",children:"التاريخ والوقت:"}),e.jsxs("span",{className:"font-mono",children:[C," ",R]})]}),e.jsxs("div",{className:"flex justify-between items-center",children:[e.jsx("span",{className:"text-paper-muted",children:"الكاشير:"}),e.jsx("span",{className:"font-bold text-paper-ink",children:h})]}),(t.salesperson_name||((f=t.salesperson)==null?void 0:f.name))&&(t.salesperson_name||((j=t.salesperson)==null?void 0:j.name))!==h&&e.jsxs("div",{className:"flex justify-between items-center",children:[e.jsx("span",{className:"text-paper-muted",children:"مسؤول البيع:"}),e.jsx("span",{className:"font-bold text-paper-ink",children:t.salesperson_name||((u=t.salesperson)==null?void 0:u.name)})]}),e.jsxs("div",{className:"flex justify-between items-center",children:[e.jsx("span",{className:"text-paper-muted",children:"العميل:"}),e.jsx("span",{className:"font-medium text-paper-ink",children:((N=t.party)==null?void 0:N.name)||t.party_name||"عميل نقدي"})]}),(((y=t.party)==null?void 0:y.phone)||t.customer_phone)&&e.jsxs("div",{className:"flex justify-between items-center",children:[e.jsx("span",{className:"text-paper-muted",children:"هاتف العميل:"}),e.jsx("span",{className:"font-mono",children:((w=t.party)==null?void 0:w.phone)||t.customer_phone})]}),(((g=t.party)==null?void 0:g.address)||t.customer_address)&&e.jsxs("div",{className:"flex justify-between items-center",children:[e.jsx("span",{className:"text-paper-muted",children:"العنوان:"}),e.jsx("span",{className:"text-left text-2xs",children:((k=t.party)==null?void 0:k.address)||t.customer_address})]}),t.courier_name&&e.jsxs("div",{className:"flex justify-between items-center",children:[e.jsx("span",{className:"text-paper-muted",children:"شركة الشحن:"}),e.jsxs("span",{className:"font-bold text-brand",children:[t.courier_name," ",t.tracking_number?`(#${t.tracking_number})`:""]})]})]}),e.jsx("div",{className:"py-2.5 border-b border-dashed border-paper-line",children:e.jsxs("table",{className:"w-full text-right text-[11px] table-fixed",children:[e.jsx("thead",{children:e.jsxs("tr",{className:"border-b border-paper-line text-paper-muted font-bold",children:[e.jsx("th",{className:"pb-1 w-[50%]",children:"الصنف"}),e.jsx("th",{className:"pb-1 text-center w-[18%]",children:"الكمية"}),e.jsx("th",{className:"pb-1 text-left w-[32%]",children:"الإجمالي"})]})}),e.jsx("tbody",{className:"divide-y divide-paper-line",children:E.map((r,m)=>e.jsxs("tr",{className:"py-1",children:[e.jsxs("td",{className:"py-1 font-bold",children:[e.jsx("div",{className:"line-clamp-1",children:r.product_name}),e.jsx(X,{variantName:r.variant_name,batchNumber:r.batch_number,unitName:r.unit_name,mode:"inline",className:"text-paper-muted"}),e.jsxs("div",{className:"text-2xs text-paper-muted font-normal",children:[e.jsx("span",{className:"font-mono",children:l(r.unit_price,n)})," للقطعة"]})]}),e.jsx("td",{className:"py-1 text-center font-bold font-mono",children:r.quantity}),e.jsx("td",{className:"py-1 text-left font-bold font-mono",children:l(r.total,n)})]},m))})]})}),e.jsxs("div",{className:"py-2.5 border-b border-dashed border-paper-line space-y-1 text-xs",children:[e.jsxs("div",{className:"flex justify-between text-paper-muted",children:[e.jsx("span",{children:"المجموع الفرعي:"}),e.jsx("span",{children:l(t.subtotal,n)})]}),Number(t.discount)>0&&e.jsxs("div",{className:"flex justify-between text-bad",children:[e.jsx("span",{children:"الخصم:"}),e.jsxs("span",{children:["-",l(t.discount,n)]})]}),Number(t.shipping_amount)>0&&e.jsxs("div",{className:"flex justify-between text-paper-ink",children:[e.jsx("span",{children:"خدمة التوصيل / الشحن:"}),e.jsx("span",{className:"font-bold",children:l(t.shipping_amount,n)})]}),e.jsxs("div",{className:"flex justify-between text-sm font-black pt-1 border-t border-paper-line",children:[e.jsx("span",{children:"الإجمالي الصافي:"}),e.jsx("span",{children:l(t.total,n)})]})]}),e.jsxs("div",{className:"py-2.5 border-b border-dashed border-paper-line space-y-1 text-[11px]",children:[e.jsxs("div",{className:"flex justify-between",children:[e.jsx("span",{className:"text-paper-muted",children:"طريقة الدفع:"}),e.jsx("span",{className:"font-bold",children:B(t.payment_method)})]}),e.jsxs("div",{className:"flex justify-between",children:[e.jsx("span",{className:"text-paper-muted",children:"المبلغ المدفوع:"}),e.jsx("span",{className:"font-bold",children:l(t.paid_amount||t.total,n)})]})]}),e.jsxs("div",{className:"pt-3 text-center space-y-1 text-2xs text-paper-muted",children:[e.jsx("p",{className:"font-sans font-bold text-paper-ink",children:"شكراً لزيارتكم ونسعد بخدمتكم دائماً!"}),e.jsx("p",{className:"font-mono text-2xs",children:"نظام إنجاز برو لإدارة نقاط البيع والمخازن"})]})]})}),e.jsxs("div",{className:"p-4 bg-panel border-t border-line space-y-2 no-print",children:[e.jsxs("div",{className:"flex items-center gap-2 flex-wrap",children:[e.jsxs(i,{type:"button",variant:"primary",onClick:z,className:"flex-1 min-w-[45%] h-12 rounded-2xl text-xs font-black shadow-md flex items-center justify-center gap-1.5",children:[e.jsx(G,{className:"w-4 h-4"}),e.jsx("span",{children:"طباعة الإيصال"})]}),e.jsxs(i,{type:"button",variant:"secondary",onClick:A,className:"flex-1 min-w-[45%] h-12 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-1.5 border border-line",children:[e.jsx(W,{className:"w-4 h-4 text-ok"}),e.jsx("span",{children:"مشاركة واتساب"})]})]}),o?e.jsxs(i,{type:"button",variant:"secondary",onClick:o,className:"w-full h-11 rounded-2xl text-xs font-black transition-colors flex items-center justify-center gap-2",children:[e.jsx(q,{className:"w-3.5 h-3.5"}),e.jsx("span",{children:"فاتورة جديدة (Esc)"})]}):e.jsx(i,{type:"button",variant:"secondary",onClick:c,className:"w-full h-11 rounded-2xl text-xs font-bold transition-colors",children:"إغلاق النافذة"})]})]}),e.jsx("style",{children:`
        @media print {
          @page {
            size: auto;
            margin: 0 !important;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: 100% !important;
            overflow: hidden !important;
            background: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body *:not(:has(#pos-thermal-receipt)):not(#pos-thermal-receipt):not(#pos-thermal-receipt *):not(style) {
            display: none !important;
          }
          #root, body *:has(#pos-thermal-receipt) {
            position: static !important;
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            background: white !important;
            overflow: visible !important;
            transform: none !important;
          }
          #pos-thermal-receipt, #pos-thermal-receipt * {
            visibility: visible !important;
          }
          #pos-thermal-receipt {
            position: relative !important;
            display: block !important;
            margin: 0 auto !important;
            width: 94% !important;
            max-width: 70mm !important;
            box-sizing: border-box !important;
            padding: 2mm 4mm !important;
            border: none !important;
            box-shadow: none !important;
            font-family: 'IBM Plex Sans Arabic', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif !important;
            font-size: 11px !important;
            line-height: 1.35 !important;
            color: black !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          #pos-thermal-receipt table {
            width: 100% !important;
            table-layout: fixed !important;
            border-collapse: collapse !important;
          }
          #pos-thermal-receipt th, #pos-thermal-receipt td {
            padding-left: 2px !important;
            padding-right: 2px !important;
            word-break: break-word !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `})]})};export{J as P};

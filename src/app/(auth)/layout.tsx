import { Icon, Logo } from "@/components/ui";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="hidden flex-col justify-between gap-7 bg-teal-700 p-14 text-white lg:flex">
        <Logo dark size={24} />
        <div className="flex flex-col gap-5">
          <h1 className="text-4xl leading-tight text-white">Build your online store with IND2B</h1>
          <ul className="flex flex-col gap-3.5 text-[15px] text-[#d7ebe8]">
            <li className="flex gap-3"><Icon name="check" size={20} /> Your store name and your own domain</li>
            <li className="flex gap-3"><Icon name="check" size={20} /> Templates and plugins, no coding</li>
            <li className="flex gap-3"><Icon name="check" size={20} /> UPI, cards, COD and GST invoices built in</li>
          </ul>
        </div>
        <span className="text-xs text-[#a8d0cb]">Free to start · no credit card needed</span>
      </div>
      <div className="flex items-center justify-center bg-surface px-6 py-12">{children}</div>
    </div>
  );
}

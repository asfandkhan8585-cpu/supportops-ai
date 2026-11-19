import { getCurrentCustomer } from "@/lib/customer-auth";
import { SupportPortal } from "./support-portal";

export default async function SupportPage() {
  const customer = await getCurrentCustomer();
  return <SupportPortal initialName={customer?.name ?? null} />;
}

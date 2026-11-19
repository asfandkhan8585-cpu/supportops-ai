import { getCurrentUser } from "@/lib/auth";
import { OrdersDesk } from "./orders-desk";

export default async function OrdersPage() {
  const user = await getCurrentUser();
  return <OrdersDesk canDecide={user?.role === "admin"} />;
}

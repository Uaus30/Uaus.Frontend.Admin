import { fetchAllPages, type CustomerDto } from "@workspace/api-client-react";

export async function getAllCustomers() {
  return fetchAllPages<CustomerDto>("/Customers");
}

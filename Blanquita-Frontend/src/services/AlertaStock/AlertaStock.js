import {
  UmbralStockItem,
  ListarUmbralesStockRequest,
  EditarUmbralStockRequest
} from "@/models/AlertaStock/AlertaStock";
import { pedirJson } from "@/utils/api";
import { conQueryParams } from "@/utils/params";

const BASE_URL = "/api/alertastock";

export async function listarUmbralesStock(dominio) {
  const data = await pedirJson(
    conQueryParams(`${BASE_URL}/umbrales`, ListarUmbralesStockRequest(dominio))
  );

  return data.map(UmbralStockItem);
}

export async function editarUmbralStock(dominio, id, datos) {
  const data = await pedirJson(`${BASE_URL}/umbral`, {
    method: "PATCH",
    body: EditarUmbralStockRequest(dominio, id, datos)
  });

  return UmbralStockItem(data);
}

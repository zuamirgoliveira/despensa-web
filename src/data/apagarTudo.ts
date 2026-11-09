// Apagar todos os dados do aparelho (Ajustes → Zona de perigo). Não tem volta: a tela exige dupla confirmação.
import type { Repositorios } from "./repositorios";

/** O que existe hoje no aparelho, para a pessoa ver o que vai perder. */
export async function contagemDoAparelho(repos: Repositorios): Promise<{ compras: number; produtos: number; mercados: number; listas: number }> {
  const [compras, produtos, mercados, listas] = await Promise.all([
    repos.compras.listar(),
    repos.produtos.listar(),
    repos.mercados.listar(),
    repos.listas.listar(),
  ]);
  return { compras: compras.length, produtos: produtos.length, mercados: mercados.length, listas: listas.length };
}

/**
 * Apaga tudo (todas as coleções, numa única transação) e recria a casa com os valores iniciais, como na
 * primeira abertura. A preferência de tema (localStorage) não é dado do usuário e fica.
 */
export async function apagarTodosOsDados(repos: Repositorios): Promise<void> {
  await repos.restaurar(
    { casas: [], perfis: [], agendas: [], mercados: [], produtos: [], apelidos: [], estoques: [], compras: [], listas: [], itensLista: [], conferencias: [], notasPendentes: [] },
    "substituir",
  );
  await repos.iniciar();
}

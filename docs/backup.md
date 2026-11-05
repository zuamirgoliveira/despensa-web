# Backup, restauração e troca de aparelho

Os dados ficam **só no aparelho** (IndexedDB do navegador). Perder ou limpar o navegador sem backup perde tudo. Não há sincronização.

## Exportar

**Mais → Ajustes → Backup → Exportar backup**. Baixa `despensa-backup-AAAA-MM-DD.json` com todas as coleções (casa, perfil, agenda, mercados, produtos, apelidos, estoque, compras, listas, conferências). O arquivo **não** contém CPF nem o texto bruto das notas.

Rotina sugerida: exportar pelo menos uma vez por mês e guardar o arquivo fora do celular (nuvem pessoal, e-mail para si).

## Restaurar / trocar de aparelho

1. No aparelho novo, instale e abra o app (ele cria uma casa padrão vazia).
2. **Ajustes → Backup → Importar backup** e escolha o arquivo.
3. O app valida o arquivo inteiro antes de gravar. Arquivo inválido ou de versão mais nova que a do app é recusado com mensagem clara.
4. A casa padrão vazia criada na abertura é removida; os dados do backup passam a valer.

A importação é **idempotente**: importar o mesmo arquivo duas vezes não duplica nada (registros com o mesmo identificador são sobrescritos).

## Cuidados

- Importar sobrescreve registros de mesmo identificador; não apaga o que só existe no aparelho.
- O armazenamento é por endereço (origem): abrir o app por outro domínio é outro banco, vazio.
- Dados de desenvolvimento: `npm run seed:dev` gera `dev-data/despensa-seed.json`, que se importa pelo mesmo caminho.

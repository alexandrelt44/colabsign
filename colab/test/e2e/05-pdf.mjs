// PDF de teste (contrato fictício, uma página A4).
import { OUT, connect, newPage } from "./lib.mjs";

const browser = await connect();
const { page } = await newPage(browser, 800, 1100);
await page.setContent(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>
@page{size:A4;margin:0}body{font-family:Helvetica,Arial,sans-serif;margin:0;padding:56px 64px;color:#1C1A17;font-size:12.5px;line-height:1.55}
h1{font-size:20px;margin:0 0 4px}small{color:#5E5A52}.box{border-top:1px solid #BDB6AA;width:44%;display:inline-block;margin-top:250px;padding-top:6px;margin-right:10%}
</style></head><body>
<h1>Contrato de prestação de serviços (TESTE)</h1><small>Documento fictício para testar o ColabSign. Não tem valor legal.</small>
<p><b>Contratante:</b> Empresa Fictícia Ltda., CNPJ 00.000.000/0001-00.<br><b>Contratada:</b> Colaboratório (teste).</p>
<p><b>1. Objeto.</b> Prestação de serviços de consultoria em processos, conforme proposta PR-0001 (fictícia).</p>
<p><b>2. Valor.</b> R$ 1.000,00 por mês, pagos por Pix até o dia 10 de cada mês.</p>
<p><b>3. Vigência.</b> 12 meses a partir da assinatura, renováveis por acordo entre as partes.</p>
<p><b>4. Foro.</b> Rio de Janeiro, RJ.</p>
<div class="box">Contratante</div><div class="box">Contratada</div>
</body></html>`);
await page.pdf({
  path: `${OUT}/contrato-teste.pdf`,
  format: "A4",
  printBackground: true,
});
console.log("[pdf] ok");
await browser.close();

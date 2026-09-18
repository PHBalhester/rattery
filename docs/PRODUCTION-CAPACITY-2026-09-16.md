# Estimativa de capacidade e custo de produção — RATTERY

Data: 16/09/2026. Base de código: 32681aa. Não é uma fatura prevista nem um teste na Railway.

**Conclusão:** o Railway Hobby tem capacidade de CPU/RAM para começarmos. O código atual exige otimização de persistência, rede e retenção antes de produção. Não há evidência para prometer uma produção completa de US$ 5/mês. A compra do Pro por si só não corrige esses problemas.

## O que foi realmente medido

Capturas existentes:
- ZZZ: 159 trades nos primeiros 100 blocos, timestamps extremos separados por 10 s: aproximadamente 15,9 trades/s nessa janela de lançamento.
- BISCOTTI: 187 trades nos primeiros 200 blocos, timestamps extremos separados por 20 s: aproximadamente 9,35 trades/s nessa janela.
- Essas são janelas curtas de atividade intensa, com resolução de timestamp de um segundo. Não representam médias diárias, previsão de volume do RATTERY ou cobertura de todos os pools.
- O limite atual da colônia é de 80 ratos vivos. A renderização 3D ocorre no dispositivo do visitante, não na CPU/GPU da Railway.

Ensaio novo: seis cenários de 4, 40 e 80 ratos, com 0 ou 10 trades/s controlados, 200 ticks por cenário (20 segundos simulados), mais um ensaio com relógio real. PostgreSQL local por Unix socket, Node 24, Intel i5-13400F/WSL. Sem consulta de carga à mainnet, assinatura ou transação financeira.

Resumo dos cenários acelerados com 10 trades/s:

| Ratos | vCPU equivalente do Node a 10 ticks/s | Pico RSS Node | Consultas SQL/s simulado | Snapshot JSON | Snapshot gzip |
|---|---:|---:|---:|---:|---:|
| 4 | 0.026 | 183 MB | 169 | 6.0 kB | 2.0 kB |
| 40 | 0.127 | 285 MB | 889 | 57.0 kB | 8.0 kB |
| 80 | 0.210 | 325 MB | 1689 | 109.8 kB | 13.4 kB |

A coluna vCPU divide tempo de CPU por tempo simulado; não mede uma vCPU Railway. RSS é pico, não média faturável. PostgreSQL e o coletor RPC não estão incluídos nesses números. O agrupamento do worker real pode reduzir a frequência de gravação em relação ao ensaio acelerado.

**Relógio real:** 80 ratos, zero trades, 28.9 segundos, cerca de 0.19 vCPU Node, 299 MB de pico RSS, 1162 consultas/s. Latência local mediana 43.1 ms / p95 59.4 ms por chamada de avanço. Isso é um ensaio curto, não um teste de estabilidade de dias.

## Como a Railway cobra

Tarifas consultadas na documentação oficial:
- Memória: US$ 10 por GB-mês.
- CPU: US$ 20 por vCPU-mês.
- Saída de rede: US$ 0,05 por GB.
- Volume: US$ 0,15 por GB-mês.
- Hobby: mínimo US$ 5/mês, incluindo US$ 5 de uso, sem somar outros US$ 5 ao excedente.

Os números grandes da tela são limites máximos, não recursos incluídos gratuitamente. As contas de tráfego abaixo usam 30 dias e divisor binário 2^30, explicitado para reprodução.

Fonte: https://docs.railway.com/pricing/plans
Fonte de dimensionamento: https://docs.railway.com/guides/right-size-cpu-memory

## Gargalo 1: comunicação com banco externo

O ensaio real enviou 47.75 MB em parâmetros JSON ao banco em 28.9 segundos: aproximadamente 1.65 MB/s. Mantido por 30 dias, isso corresponde a 3989 GiB ou **US$ 199 em saída de rede**, se o worker Railway se comunicar com um banco externo e esse tráfego for cobrado.

Isso não é captura de pacotes: mede parâmetros serializados das consultas. Protocolo/TLS acrescentam overhead; agrupamento de ticks, latência, uso de rede privada e otimizações mudam muito o resultado. Não é correto chamar isso de fatura prevista da Neon/Railway. É evidência de que o desenho atual pode gastar centenas em comunicação evitável.

O código reconsulta e regrava registros individuais e o estado completo em cada transação de avanço. Com banco remoto, as muitas consultas sequenciais também podem atrasar a simulação. Mais plano/CPU não resolve latência por consulta.

Ações recomendadas antes da produção: reduzir consultas e escritas redundantes, agrupar a persistência preservando atomicidade dos cuidados, colocar banco/worker próximos e avaliar rede privada no mesmo projeto. Não mudar a periodicidade de persistência sem definir recuperação após falha.

## Gargalo 2: envio para espectadores

O observador de laboratório solicita o estado completo a cada 500 ms. Não existe ainda um servidor público de snapshots na Railway. Para dimensionar esse desenho, a amostra real com 80 ratos resultou em 104.4 kB JSON / 12.2 kB gzip.

Se gzip for habilitado e os snapshots forem servidos pela Railway:
- Um espectador médio conectado continuamente: aproximadamente 58.8 GiB/mês, US$ 2.94 somente de saída.
- Dez espectadores simultâneos **em média ao longo de todo o mês**: aproximadamente US$ 29.
- Cem espectadores simultâneos médios: aproximadamente US$ 294.

As outras amostras de 80 ratos elevam essa projeção a cerca de US$ 33 / US$ 330 para 10 / 100 espectadores. Não são visitantes únicos mensais. Dez pessoas por duas horas diárias equivalem a 0,83 espectadores contínuos. Esses cálculos excluem cabeçalhos, reconexões, CPU de compressão, assets 3D e tráfego do site na Vercel. Gzip foi medido localmente; não está presumido ativo em uma rota pública inexistente.

Transmitir apenas mudanças/posições necessárias, compartilhar snapshots comprimidos entre clientes e interpolar no navegador pode reduzir bastante esse custo. Ainda não foi medido um protocolo otimizado.

## Gargalo 3: armazenamento

Ensaio de tabelas novas com 10.000 registros e índices:
- Bloco: aproximadamente 202 bytes por registro.
- Trade aplicado: aproximadamente 1,47 kB por registro (identificador sintético abreviado; planejar 1,5–2 kB).
- Na cadência de cerca de dez blocos/s observada nas capturas, registrar todos os blocos, inclusive vazios, soma 25,92 milhões de linhas/mês: aproximadamente 5,24 GB decimais / 4,88 GiB.
- Um trade/s sustentado: mais 3,82 GB decimais / 3,56 GiB por mês.
- Dez trades/s sustentados: mais 38,18 GB decimais / 35,56 GiB por mês.

Isso exclui memória do banco, snapshots antigos, genealogia, WAL retido, backups e bloat. O volume de 5 GB do Hobby não comporta retenção indefinida desse desenho. Se o banco continuar na Neon, o limite de volume da Railway não se aplica a ele, mas a capacidade/cobrança do banco continuam separadas.

O WAL gerado nos ensaios é churn de escrita, não crescimento líquido permanente de disco; não foi somado como armazenamento mensal. Precisamos de checkpoints/arquivo de blocos e política de histórico sem apagar a genealogia requerida.

## Avaliação e orçamento

**Escolha recomendada: Hobby para homologação; produção condicionada às otimizações e à medição hospedada.** Não há motivo medido para comprar Pro apenas por CPU/RAM agora. O armazenamento de 5 GB é uma limitação real se o PostgreSQL ficar na Railway com o esquema atual.

Faixas de planejamento, não resultados de benchmark/fatura:
- Worker + PostgreSQL próximos/rede privada, sem tráfego público relevante, após otimização: reservar **US$ 15–30/mês**. Exemplo de recursos médios hipotéticos: 1 GB de RAM somado e 0,25–0,5 vCPU somada custa US$ 15–20 antes de rede/armazenamento.
- Com dez espectadores médios e mantendo o envio completo comprimido atual: aproximadamente **US$ 45–65/mês** incluindo a base acima.
- Com cem espectadores médios nesse mesmo protocolo: aproximadamente **US$ 310–360/mês**.
- Na arquitetura atual com banco externo, a comunicação pode adicionar centenas; portanto as faixas otimizadas não são promessa para o código presente.

Essas faixas não incluem impostos, câmbio, plano comercial da Vercel, banco externo, RPC pago, backup externo ou arquivo histórico. A média real de trades e a audiência ainda são desconhecidas. As capturas de lançamento não devem ser multiplicadas por um mês para prever demanda.

O coletor atual solicita um cabeçalho por bloco: nessa cadência seriam cerca de 26 milhões de leituras RPC/mês, além de logs/âncoras/transações. É necessário validar quota e capacidade do RPC; o endpoint público não deve ser tratado como SLA gratuito ilimitado.

Próxima validação: corrigir os gargalos, rodar 24–72 horas no host escolhido em população/volume representativos, medir CPU/RAM média, egress real, atraso de blocos/ticks, crescimento do banco e custo no painel. Só então fechar o orçamento de produção e seus alertas/limites.

Nenhuma configuração de produção, DNS, assinatura ou recurso cobrado foi alterado para esta análise.

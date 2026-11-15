/* =====================================================================
   Dicionário de Dados - ATL Clinic
   Fonte única: atl_clinic_ddl.sql (17 tabelas, 113 colunas), DER v1.4 e
   Especificação de Requisitos v1.4. Os tipos, chaves e constraints abaixo
   reproduzem o DDL; descrições, privacidade, linhagem e RBAC são metadados
   de governança derivados dos requisitos (RF, RN, PR, RNF).
   ===================================================================== */

"use strict";

/* ---------------------------------------------------------------------
   1. Metadados do projeto
   --------------------------------------------------------------------- */
const PROJETO = {
  empresa: "ATL Clinic",
  sistema: "Sistema de Gestão Operacional e Reservas",
  versaoDicionario: "1.0 (base: DDL, DER v1.4 e Especificação v1.4)",
  escopo:
    "Banco de dados relacional da ATL Clinic, empresa de coworking médico de São Paulo/SP que cede " +
    "consultórios com e sem maca, centro cirúrgico e equipamentos a médicos parceiros, por hora ou por " +
    "período de 4 horas. O modelo registra médicos, contratos e termos de responsabilidade, catálogo de " +
    "salas e equipamentos com histórico de tarifas, reservas sem sobreposição, faturamento mensal com " +
    "pagamentos, usuários com perfis de acesso, trilha de auditoria append-only e solicitações de titulares " +
    "(LGPD). Nenhuma tabela armazena dados de pacientes (EN-01).",
  tecnologia: [
    ["SGBD", "MySQL 8.4 LTS"],
    ["Storage engine", "InnoDB"],
    ["Charset / collation", "utf8mb4 / utf8mb4_0900_ai_ci"],
    ["sql_mode", "STRICT_TRANS_TABLES, ONLY_FULL_GROUP_BY, NO_ZERO_DATE, NO_ZERO_IN_DATE, ERROR_FOR_DIVISION_BY_ZERO, NO_ENGINE_SUBSTITUTION"],
    ["Objetos", "17 tabelas, 113 colunas, 10 índices secundários, 42 triggers, 3 funções, 4 procedures, 1 view, 1 evento"]
  ],
  responsaveis: [
    { nome: "Prof. Dr. Diego Marques de Carvalho", papel: "Professor orientador", resp: "Validação acadêmica e aprovação final do modelo." },
    { nome: "Gabriella Basilio Rocha dos Santos", ra: "47778041", papel: "Data Owner", resp: "Líder do grupo. Aprova regras de negócio, classificação dos dados e mudanças no modelo." },
    { nome: "Maria Clara Farias Coelho", ra: "47968427", papel: "Data Steward de Negócio", resp: "Analista de requisitos. Mantém definições, regras (RN) e rastreabilidade com os RFs." },
    { nome: "Valter Geronimo da Silva Junior", ra: "47807458", papel: "Data Steward Técnico", resp: "Modelagem, DER, script DDL e manutenção deste dicionário." },
    { nome: "Vitória de Paula Melo", ra: "47777737", papel: "Data Steward de Privacidade", resp: "Classificação LGPD, fluxo de solicitações de titulares e anonimização." },
    { nome: "Kayk Alberto Santana Ferreira", ra: "47792426", papel: "Data Custodian", resp: "Segurança operacional: contas do SGBD, criptografia, backup e recuperação." },
    { nome: "Miguel Marcos", ra: "47963549", papel: "Analista de Qualidade de Dados", resp: "Testes de integridade, concorrência e critérios de aceitação." }
  ]
};

/* Perfis de acesso da Seção 3.1 (C = criar, R = ler, U = atualizar, I = inativar) */
const PERFIS = ["MEDICO", "RECEPCAO", "FINANCEIRO", "ADMINISTRADOR"];

const RBAC = {
  cadastro_medico: { MEDICO: "R (próprio)", RECEPCAO: "C, R, U", FINANCEIRO: "R", ADMINISTRADOR: "C, R, U, I" },
  contrato: { MEDICO: "R (próprio)", RECEPCAO: "R", FINANCEIRO: "R", ADMINISTRADOR: "C, R, U, I" },
  termo: { MEDICO: "C, R (próprio contrato)", RECEPCAO: "R", FINANCEIRO: "-", ADMINISTRADOR: "C, R" },
  catalogo: { MEDICO: "R (ativos)", RECEPCAO: "R", FINANCEIRO: "R", ADMINISTRADOR: "C, R, U, I" },
  reserva: { MEDICO: "C, R (próprias); U (cancelar própria)", RECEPCAO: "C, R, U", FINANCEIRO: "R", ADMINISTRADOR: "R, U" },
  faturamento: { MEDICO: "R (próprias)", RECEPCAO: "-", FINANCEIRO: "C, R", ADMINISTRADOR: "R" },
  pagamento: { MEDICO: "-", RECEPCAO: "-", FINANCEIRO: "C, R", ADMINISTRADOR: "R" },
  usuario: { MEDICO: "R, U (própria senha)", RECEPCAO: "-", FINANCEIRO: "-", ADMINISTRADOR: "C, R, U, I" },
  solicitacao: { MEDICO: "-", RECEPCAO: "C, R", FINANCEIRO: "-", ADMINISTRADOR: "C, R, U" },
  auditoria: { MEDICO: "-", RECEPCAO: "-", FINANCEIRO: "-", ADMINISTRADOR: "R" }
};

/* Blocos do DER: usados para agrupar a navegação e colorir as seções */
const BLOCOS = {
  cadastro: "Cadastros e acessos",
  catalogo: "Catálogo de espaços e tarifas",
  transacional: "Reservas e faturamento",
  auditoria: "Auditoria, acesso e LGPD"
};

/* ---------------------------------------------------------------------
   2. Dicionário: 17 tabelas, na ordem de criação do DDL
   Campos da coluna: n = nome, d = descrição/regra, t = tipo, c = constraints,
   p = privacidade (DPS | DP | NA), l = linhagem, r = acesso (opcional,
   sobrescreve o RBAC da tabela para a coluna)
   --------------------------------------------------------------------- */
const TABELAS = [
  /* ------------------------------------------------------------ usuario */
  {
    nome: "usuario",
    bloco: "cadastro",
    finalidade: "Contas de acesso ao sistema com perfil único (RBAC). Base da autenticação, do bloqueio por tentativas e da autoria na trilha de auditoria.",
    requisitos: "RF06, RF10, RF11 · PR02, PR04 · RNF01, RNF09",
    owner: "Administração (TI)",
    retencao: "Sem exclusão física; inativação por ativo = 0; anonimização via sp_anonimizar_titular quando vinculado a médico.",
    rbac: "usuario",
    gatilhos: "trg_aud_usuario_ai, trg_aud_usuario_au",
    colunas: [
      { n: "id_usuario", d: "Identificador sequencial do usuário.", t: "INT UNSIGNED", c: "[PK] [AUTO_INCREMENT] [NOT NULL]", p: "NA", l: "Origem: gerado pelo SGBD. Destino: medico, log_auditoria, registro_acesso (FK)." },
      { n: "nome", d: "Nome completo do usuário. Substituído por 'ANONIMIZADO' no atendimento de anonimização (RF11).", t: "VARCHAR(150)", c: "[NOT NULL]", p: "DP", l: "Origem: cadastro RF06 (Administrador). Destino: sp_exportar_titular; tela de usuários." },
      { n: "email", d: "E-mail corporativo ou pessoal, único no sistema. Na anonimização vira anonimizado.<id>@invalido.local.", t: "VARCHAR(255)", c: "[UK uk_usuario_email] [NOT NULL]", p: "DP", l: "Origem: cadastro RF06. Destino: sp_exportar_titular." },
      { n: "login", d: "Nome de acesso, único. Na anonimização vira anon_<id>.", t: "VARCHAR(50)", c: "[UK uk_usuario_login] [NOT NULL]", p: "DP", l: "Origem: cadastro RF06. Destino: autenticação; registro_acesso.login_informado." },
      { n: "senha_hash", d: "Hash da senha em Argon2id ou bcrypt (custo >= 12). Nunca armazena senha em texto claro (RNF09).", t: "VARCHAR(255)", c: "[NOT NULL]", p: "DP", l: "Origem: aplicação (hash gerado antes do INSERT). Destino: somente verificação de login.", r: "Nenhum perfil lê; acesso exclusivo do serviço de autenticação. Médico altera a própria senha." },
      { n: "perfil", d: "Papel RBAC do usuário (Seção 3.1).", t: "ENUM('MEDICO','RECEPCAO','FINANCEIRO','ADMINISTRADOR')", c: "[NOT NULL]", p: "NA", l: "Origem: cadastro RF06. Destino: autorização da aplicação; log_auditoria (JSON)." },
      { n: "ativo", d: "Situação da conta: 1 = ativa, 0 = inativa. Usuário inativo não autentica.", t: "BOOLEAN", c: "[NOT NULL] [DEFAULT 1] [CHECK ck_usuario_ativo: 0 ou 1]", p: "NA", l: "Origem: RF06; sp_anonimizar_titular. Destino: autenticação; log_auditoria." },
      { n: "tentativas_falha", d: "Contador de falhas consecutivas de login; dispara bloqueio de 15 min ao atingir 5 (RNF01).", t: "TINYINT UNSIGNED", c: "[NOT NULL] [DEFAULT 0]", p: "NA", l: "Origem: serviço de autenticação. Destino: log_auditoria (JSON)." },
      { n: "data_bloqueio_ate", d: "Instante até o qual o login fica bloqueado. NULL = sem bloqueio.", t: "DATETIME", c: "[NULL]", p: "NA", l: "Origem: serviço de autenticação (RNF01). Destino: autenticação; registro_acesso (BLOQUEADO)." }
    ]
  },

  /* ------------------------------------------------------------- medico */
  {
    nome: "medico",
    bloco: "cadastro",
    finalidade: "Médicos parceiros que reservam espaços. Guarda CPF cifrado, hash para unicidade, CRM e marcos de cadastro, inativação e anonimização.",
    requisitos: "RF01, RF02, RF04, RF05, RF11 · RN02, RN07, RN09 · PR01, PR02 · RNF09",
    owner: "Operações (Recepção)",
    retencao: "5 anos após a última fatura (PR01); depois disso, anonimização irreversível sob solicitação (PR02).",
    rbac: "cadastro_medico",
    gatilhos: "trg_medico_bu, trg_aud_medico_ai, trg_aud_medico_au",
    colunas: [
      { n: "id_medico", d: "Identificador sequencial do médico.", t: "INT UNSIGNED", c: "[PK] [AUTO_INCREMENT] [NOT NULL]", p: "NA", l: "Origem: gerado pelo SGBD. Destino: telefone_medico, medico_especialidade, contrato, reserva, faturamento, solicitacao_titular (FK)." },
      { n: "id_usuario", d: "Conta de acesso do médico (relação 1:0..1 com usuario). Deve apontar para usuário de perfil MEDICO.", t: "INT UNSIGNED", c: "[FK → usuario.id_usuario] [UK uk_medico_usuario] [NOT NULL] [ON DELETE RESTRICT] [ON UPDATE CASCADE]", p: "NA", l: "Origem: RF01 a partir de usuario (RF06). Destino: sp_anonimizar_titular; sp_exportar_titular." },
      { n: "cpf", d: "CPF cifrado em AES-256-GCM pela aplicação; chave fora do banco (RNF09). NULL somente após anonimização.", t: "VARBINARY(255)", c: "[NULL] [CHECK ck_medico_cpf: cpf e cpf_hash preenchidos ou data_anonimizacao preenchida]", p: "DP", l: "Origem: cadastro RF01 (Recepção), cifrado na aplicação. Destino: anulado por sp_anonimizar_titular.", r: "Decifrado apenas pela aplicação para Recepção e Administrador; SELECT direto retorna valor cifrado." },
      { n: "cpf_hash", d: "HMAC-SHA256 do CPF normalizado; garante unicidade sem expor o CPF (PR02).", t: "BINARY(32)", c: "[UK uk_medico_cpf_hash] [NULL] [CHECK ck_medico_cpf]", p: "DP", l: "Origem: aplicação, calculado a partir do CPF. Destino: verificação de duplicidade (ERR-DUP-001); anulado na anonimização.", r: "Uso interno da aplicação; não exibido em tela." },
      { n: "crm_numero", d: "Número do registro no Conselho Regional de Medicina; único em conjunto com crm_uf.", t: "VARCHAR(10)", c: "[UK uk_medico_crm (crm_numero, crm_uf)] [NOT NULL]", p: "DP", l: "Origem: cadastro RF01. Destino: log_auditoria (JSON); sp_exportar_titular." },
      { n: "crm_uf", d: "UF do CRM, duas letras maiúsculas.", t: "CHAR(2)", c: "[UK uk_medico_crm] [NOT NULL] [CHECK ck_medico_crm_uf: ^[A-Z]{2}$]", p: "DP", l: "Origem: cadastro RF01. Destino: log_auditoria (JSON); sp_exportar_titular." },
      { n: "data_cadastro", d: "Data e hora de inclusão do médico, definida pelo servidor.", t: "DATETIME", c: "[NOT NULL] [DEFAULT CURRENT_TIMESTAMP]", p: "NA", l: "Origem: SGBD no INSERT. Destino: sp_exportar_titular." },
      { n: "ativo", d: "1 = ativo, 0 = inativo. Inativação bloqueada se houver fatura diferente de PAGO (RN07); médico inativo não reserva (RN09).", t: "BOOLEAN", c: "[NOT NULL] [DEFAULT 1] [CHECK ck_medico_ativo: 0 ou 1]", p: "NA", l: "Origem: RF01; sp_anonimizar_titular. Destino: trg_reserva_bi (ERR-NEG-008); log_auditoria." },
      { n: "data_anonimizacao", d: "Instante da anonimização irreversível. NULL = dados pessoais preservados.", t: "DATETIME", c: "[NULL]", p: "NA", l: "Origem: sp_anonimizar_titular (RF11). Destino: ck_medico_cpf; trg_medico_bu; log_auditoria." }
    ]
  },

  /* ---------------------------------------------------- telefone_medico */
  {
    nome: "telefone_medico",
    bloco: "cadastro",
    finalidade: "Telefones do médico, um por linha (1FN), com número cifrado.",
    requisitos: "RF01, RF11 · PR02 · RNF09",
    owner: "Operações (Recepção)",
    retencao: "Acompanha o médico; número anulado na anonimização.",
    rbac: "cadastro_medico",
    gatilhos: "Sem trigger de auditoria no DDL.",
    colunas: [
      { n: "id_telefone_medico", d: "Identificador sequencial do telefone.", t: "INT UNSIGNED", c: "[PK] [AUTO_INCREMENT] [NOT NULL]", p: "NA", l: "Origem: gerado pelo SGBD. Destino: aplicação." },
      { n: "id_medico", d: "Médico titular do telefone.", t: "INT UNSIGNED", c: "[FK → medico.id_medico] [NOT NULL] [ON DELETE RESTRICT] [ON UPDATE CASCADE]", p: "NA", l: "Origem: RF01. Destino: sp_anonimizar_titular." },
      { n: "numero", d: "Número de telefone cifrado em AES-256-GCM (RNF09). NULL após anonimização.", t: "VARBINARY(255)", c: "[NULL]", p: "DP", l: "Origem: cadastro RF01, cifrado na aplicação. Destino: anulado por sp_anonimizar_titular.", r: "Decifrado apenas pela aplicação para Recepção e Administrador." },
      { n: "tipo", d: "Classificação do telefone.", t: "ENUM('CELULAR','FIXO','COMERCIAL')", c: "[NOT NULL]", p: "NA", l: "Origem: cadastro RF01. Destino: aplicação." }
    ]
  },

  /* ------------------------------------------------------ especialidade */
  {
    nome: "especialidade",
    bloco: "cadastro",
    finalidade: "Tabela de domínio das especialidades médicas.",
    requisitos: "RF01",
    owner: "Operações (Recepção)",
    retencao: "Permanente (dado de referência).",
    rbac: "cadastro_medico",
    gatilhos: "Sem trigger de auditoria no DDL.",
    colunas: [
      { n: "id_especialidade", d: "Identificador sequencial da especialidade.", t: "INT UNSIGNED", c: "[PK] [AUTO_INCREMENT] [NOT NULL]", p: "NA", l: "Origem: gerado pelo SGBD. Destino: medico_especialidade (FK)." },
      { n: "nome", d: "Nome da especialidade, único (ex.: Dermatologia).", t: "VARCHAR(100)", c: "[UK uk_especialidade_nome] [NOT NULL]", p: "NA", l: "Origem: cadastro RF01. Destino: sp_exportar_titular." }
    ]
  },

  /* ----------------------------------------------- medico_especialidade */
  {
    nome: "medico_especialidade",
    bloco: "cadastro",
    finalidade: "Associativa que resolve o N:N entre médico e especialidade.",
    requisitos: "RF01",
    owner: "Operações (Recepção)",
    retencao: "Acompanha o médico.",
    rbac: "cadastro_medico",
    gatilhos: "Sem trigger de auditoria no DDL.",
    colunas: [
      { n: "id_medico_especialidade", d: "Identificador sequencial do vínculo.", t: "INT UNSIGNED", c: "[PK] [AUTO_INCREMENT] [NOT NULL]", p: "NA", l: "Origem: gerado pelo SGBD. Destino: aplicação." },
      { n: "id_medico", d: "Médico do vínculo; par (id_medico, id_especialidade) é único.", t: "INT UNSIGNED", c: "[FK → medico.id_medico] [UK uk_medico_especialidade (id_medico, id_especialidade)] [NOT NULL] [ON DELETE RESTRICT] [ON UPDATE CASCADE]", p: "NA", l: "Origem: RF01. Destino: sp_exportar_titular." },
      { n: "id_especialidade", d: "Especialidade do vínculo.", t: "INT UNSIGNED", c: "[FK → especialidade.id_especialidade] [UK uk_medico_especialidade] [NOT NULL] [ON DELETE RESTRICT] [ON UPDATE CASCADE]", p: "NA", l: "Origem: RF01. Destino: sp_exportar_titular." }
    ]
  },

  /* ----------------------------------------------------------- contrato */
  {
    nome: "contrato",
    bloco: "cadastro",
    finalidade: "Contrato do médico com a ATL Clinic: tipo, vigência, dia de faturamento, desconto e situação. Nasce INATIVO e só ativa com termo aceito (RN11).",
    requisitos: "RF01, RF02, RF04, RF05 · RN02, RN05, RN11 · PR01",
    owner: "Administração (Diretoria)",
    retencao: "5 anos (PR01); sem exclusão física.",
    rbac: "contrato",
    gatilhos: "trg_contrato_bi, trg_contrato_bu, trg_aud_contrato_ai, trg_aud_contrato_au",
    colunas: [
      { n: "id_contrato", d: "Identificador sequencial do contrato.", t: "INT UNSIGNED", c: "[PK] [AUTO_INCREMENT] [NOT NULL]", p: "NA", l: "Origem: gerado pelo SGBD. Destino: termo_responsabilidade, faturamento (FK)." },
      { n: "id_medico", d: "Médico contratante. No máximo um contrato ATIVO por médico (RN02).", t: "INT UNSIGNED", c: "[FK → medico.id_medico] [NOT NULL] [ON DELETE RESTRICT] [ON UPDATE CASCADE]", p: "NA", l: "Origem: RF01 (Administrador). Destino: trg_reserva_bi; sp_fechar_faturamento." },
      { n: "numero_contrato", d: "Número de identificação do contrato, único.", t: "VARCHAR(30)", c: "[UK uk_contrato_numero] [NOT NULL]", p: "NA", l: "Origem: RF01. Destino: sp_exportar_titular." },
      { n: "tipo", d: "Modalidade: AVULSO (sob demanda), PERIODO_FIXO (turno semanal fixo), PLANO_MENSAL (uso recorrente com desconto).", t: "ENUM('AVULSO','PERIODO_FIXO','PLANO_MENSAL')", c: "[NOT NULL]", p: "NA", l: "Origem: RF01. Destino: log_auditoria; sp_exportar_titular." },
      { n: "dia_faturamento", d: "Dia do mês seguinte em que a fatura vence; de 1 a 28 para existir em todos os meses.", t: "TINYINT UNSIGNED", c: "[NOT NULL] [CHECK ck_contrato_dia: 1 a 28]", p: "NA", l: "Origem: RF01. Destino: sp_fechar_faturamento (faturamento.data_vencimento)." },
      { n: "data_inicio", d: "Primeiro dia de vigência.", t: "DATE", c: "[NOT NULL]", p: "NA", l: "Origem: RF01. Destino: trg_reserva_bi (vigência); sp_fechar_faturamento." },
      { n: "data_fim", d: "Último dia de vigência. NULL = prazo indeterminado. Não pode ser anterior a data_inicio.", t: "DATE", c: "[NULL] [CHECK ck_contrato_vigencia: data_fim >= data_inicio]", p: "NA", l: "Origem: RF01. Destino: trg_reserva_bi; sp_fechar_faturamento; log_auditoria." },
      { n: "percentual_desconto", d: "Desconto aplicado ao bruto mensal (RN05), de 0 a 100.", t: "DECIMAL(5,2)", c: "[NOT NULL] [DEFAULT 0.00] [CHECK ck_contrato_desconto: 0 a 100]", p: "NA", l: "Origem: RF01 (Administrador). Destino: sp_fechar_faturamento (valor_total); log_auditoria." },
      { n: "status", d: "Situação do contrato. Nasce INATIVO; ATIVO exige termo aceito e nenhum outro contrato ATIVO do médico (ERR-NEG-005).", t: "ENUM('ATIVO','INATIVO','ENCERRADO')", c: "[NOT NULL] [DEFAULT 'INATIVO']", p: "NA", l: "Origem: RF01; trg_contrato_bi/bu. Destino: trg_reserva_bi (ERR-NEG-002); log_auditoria." }
    ]
  },

  /* --------------------------------------------- termo_responsabilidade */
  {
    nome: "termo_responsabilidade",
    bloco: "cadastro",
    finalidade: "Prova do aceite, por contrato e versão, do termo em que o médico reconhece a ATL Clinic como cedente de espaço e assume a responsabilidade assistencial (PR03). Registro inalterável.",
    requisitos: "RF05 · RN11 · PR03",
    owner: "Administração (Jurídico)",
    retencao: "5 anos após o encerramento do contrato (PR01); UPDATE bloqueado.",
    rbac: "termo",
    gatilhos: "trg_termo_bi, trg_termo_bu, trg_aud_termo_ai",
    colunas: [
      { n: "id_termo_responsabilidade", d: "Identificador sequencial do aceite.", t: "INT UNSIGNED", c: "[PK] [AUTO_INCREMENT] [NOT NULL]", p: "NA", l: "Origem: gerado pelo SGBD. Destino: log_auditoria." },
      { n: "id_contrato", d: "Contrato ao qual o aceite se refere; par (id_contrato, versao_termo) é único.", t: "INT UNSIGNED", c: "[FK → contrato.id_contrato] [UK uk_termo_contrato_versao (id_contrato, versao_termo)] [NOT NULL] [ON DELETE RESTRICT] [ON UPDATE CASCADE]", p: "NA", l: "Origem: RF05 (Médico ou Administrador). Destino: trg_contrato_bu (ativação)." },
      { n: "versao_termo", d: "Versão do texto do termo aceito.", t: "VARCHAR(20)", c: "[UK uk_termo_contrato_versao] [NOT NULL]", p: "NA", l: "Origem: RF05. Destino: log_auditoria." },
      { n: "aceite", d: "Confirmação do aceite; somente o valor 1 é aceito.", t: "BOOLEAN", c: "[NOT NULL] [CHECK ck_termo_aceite: aceite = 1]", p: "NA", l: "Origem: RF05. Destino: trg_contrato_bu." },
      { n: "meio_aceite", d: "Canal do aceite: ELETRONICO (médico) ou IMPRESSO (Administrador).", t: "ENUM('ELETRONICO','IMPRESSO')", c: "[NOT NULL]", p: "NA", l: "Origem: RF05. Destino: log_auditoria." },
      { n: "data_hora_aceite", d: "Instante do aceite, sempre definido pelo servidor (trg_termo_bi sobrescreve o valor informado).", t: "DATETIME", c: "[NOT NULL] [DEFAULT CURRENT_TIMESTAMP]", p: "NA", l: "Origem: trg_termo_bi. Destino: prova documental (PR03)." }
    ]
  },

  /* --------------------------------------------------------------- sala */
  {
    nome: "sala",
    bloco: "catalogo",
    finalidade: "Catálogo de salas cedidas, com tipo, tarifa vigente espelhada e unidade de cobrança.",
    requisitos: "RF03, RF09, RF12 · RN01, RN03, RN09",
    owner: "Operações (Administração)",
    retencao: "Permanente; inativação por ativo = 0.",
    rbac: "catalogo",
    gatilhos: "trg_sala_ai, trg_sala_au, trg_aud_sala_ai, trg_aud_sala_au",
    colunas: [
      { n: "id_sala", d: "Identificador sequencial da sala.", t: "INT UNSIGNED", c: "[PK] [AUTO_INCREMENT] [NOT NULL]", p: "NA", l: "Origem: gerado pelo SGBD. Destino: reserva, historico_tarifa (FK)." },
      { n: "nome", d: "Nome de exibição da sala.", t: "VARCHAR(100)", c: "[NOT NULL]", p: "NA", l: "Origem: RF03. Destino: agenda RF09." },
      { n: "tipo", d: "Categoria do espaço.", t: "ENUM('CONSULTORIO_COM_MACA','CONSULTORIO_SEM_MACA','CENTRO_CIRURGICO')", c: "[NOT NULL]", p: "NA", l: "Origem: RF03. Destino: agenda RF09." },
      { n: "tarifa_base", d: "Tarifa vigente por unidade de cobrança, maior que zero. Espelho da linha aberta em historico_tarifa; alteração gera nova vigência.", t: "DECIMAL(10,2)", c: "[NOT NULL] [CHECK ck_sala_tarifa: > 0]", p: "NA", l: "Origem: RF03/RF12. Destino: trg_sala_ai/au → historico_tarifa; log_auditoria." },
      { n: "unidade_cobranca", d: "HORA (fração de 30 min arredondada para cima) ou PERIODO (bloco de 4 h) (RN03).", t: "ENUM('HORA','PERIODO')", c: "[NOT NULL]", p: "NA", l: "Origem: RF03. Destino: trg_reserva_bi via fn_valor_uso." },
      { n: "ativo", d: "1 = disponível para reserva; 0 = inativa (ERR-NEG-009).", t: "BOOLEAN", c: "[NOT NULL] [DEFAULT 1] [CHECK ck_sala_ativo: 0 ou 1]", p: "NA", l: "Origem: RF03. Destino: trg_reserva_bi; agenda RF09; log_auditoria." }
    ]
  },

  /* -------------------------------------------------------- equipamento */
  {
    nome: "equipamento",
    bloco: "catalogo",
    finalidade: "Catálogo de equipamentos locáveis junto com a sala, identificados por número de patrimônio.",
    requisitos: "RF03, RF09, RF12 · RN01, RN03, RN09",
    owner: "Operações (Administração)",
    retencao: "Permanente; inativação por ativo = 0.",
    rbac: "catalogo",
    gatilhos: "trg_equipamento_ai, trg_equipamento_au, trg_aud_equipamento_ai, trg_aud_equipamento_au",
    colunas: [
      { n: "id_equipamento", d: "Identificador sequencial do equipamento.", t: "INT UNSIGNED", c: "[PK] [AUTO_INCREMENT] [NOT NULL]", p: "NA", l: "Origem: gerado pelo SGBD. Destino: reserva_equipamento, historico_tarifa (FK)." },
      { n: "nome", d: "Nome de exibição do equipamento.", t: "VARCHAR(100)", c: "[NOT NULL]", p: "NA", l: "Origem: RF03. Destino: agenda RF09." },
      { n: "numero_patrimonio", d: "Número de patrimônio, único (ERR-DUP-001).", t: "VARCHAR(30)", c: "[UK uk_equipamento_patrimonio] [NOT NULL]", p: "NA", l: "Origem: RF03. Destino: controle patrimonial." },
      { n: "tarifa_base", d: "Tarifa vigente, maior que zero; espelho de historico_tarifa.", t: "DECIMAL(10,2)", c: "[NOT NULL] [CHECK ck_equipamento_tarifa: > 0]", p: "NA", l: "Origem: RF03/RF12. Destino: trg_equipamento_ai/au → historico_tarifa; log_auditoria." },
      { n: "unidade_cobranca", d: "HORA ou PERIODO (RN03).", t: "ENUM('HORA','PERIODO')", c: "[NOT NULL]", p: "NA", l: "Origem: RF03. Destino: trg_resequip_bi via fn_valor_uso." },
      { n: "ativo", d: "1 = disponível; 0 = inativo (ERR-NEG-009).", t: "BOOLEAN", c: "[NOT NULL] [DEFAULT 1] [CHECK ck_equipamento_ativo: 0 ou 1]", p: "NA", l: "Origem: RF03. Destino: trg_resequip_bi; agenda RF09; log_auditoria." }
    ]
  },

  /* --------------------------------------------------- historico_tarifa */
  {
    nome: "historico_tarifa",
    bloco: "catalogo",
    finalidade: "Linha do tempo de preços de salas e equipamentos. Cada linha referencia exatamente um item (trg_histtarifa_bi). Base de fn_tarifa_vigente.",
    requisitos: "RF03, RF12 · RN03",
    owner: "Financeiro",
    retencao: "5 anos (PR01), por sustentar valores faturados.",
    rbac: "catalogo",
    gatilhos: "trg_histtarifa_bi, trg_aud_histtarifa_ai",
    colunas: [
      { n: "id_historico_tarifa", d: "Identificador sequencial da vigência.", t: "INT UNSIGNED", c: "[PK] [AUTO_INCREMENT] [NOT NULL]", p: "NA", l: "Origem: gerado pelo SGBD. Destino: log_auditoria." },
      { n: "id_sala", d: "Sala da vigência. Preenchido se e somente se id_equipamento for NULL.", t: "INT UNSIGNED", c: "[FK → sala.id_sala] [NULL] [ON DELETE RESTRICT] [ON UPDATE CASCADE]", p: "NA", l: "Origem: trg_sala_ai/au. Destino: fn_tarifa_vigente." },
      { n: "id_equipamento", d: "Equipamento da vigência. Preenchido se e somente se id_sala for NULL.", t: "INT UNSIGNED", c: "[FK → equipamento.id_equipamento] [NULL] [ON DELETE RESTRICT] [ON UPDATE CASCADE]", p: "NA", l: "Origem: trg_equipamento_ai/au. Destino: fn_tarifa_vigente." },
      { n: "tarifa_base", d: "Valor da tarifa na vigência, maior que zero.", t: "DECIMAL(10,2)", c: "[NOT NULL] [CHECK ck_histtarifa_valor: > 0]", p: "NA", l: "Origem: sala.tarifa_base ou equipamento.tarifa_base. Destino: reserva.valor_cobrado, reserva_equipamento.valor_cobrado." },
      { n: "data_inicio_vigencia", d: "Primeiro dia em que a tarifa vale (data local America/Sao_Paulo).", t: "DATE", c: "[NOT NULL]", p: "NA", l: "Origem: fn_agora_local() nos triggers de sala/equipamento. Destino: fn_tarifa_vigente." },
      { n: "data_fim_vigencia", d: "Dia de encerramento da vigência. NULL = tarifa vigente.", t: "DATE", c: "[NULL] [CHECK ck_histtarifa_vigencia: fim >= início]", p: "NA", l: "Origem: trg_sala_au / trg_equipamento_au no reajuste. Destino: fn_tarifa_vigente." }
    ]
  },

  /* -------------------------------------------------------- faturamento */
  {
    nome: "faturamento",
    bloco: "transacional",
    finalidade: "Fatura mensal por médico (demonstrativo interno, não substitui nota fiscal). Imutável após o fechamento, exceto status_pagamento.",
    requisitos: "RF04, RF08 · RN05, RN06, RN07, RN13 · PR01",
    owner: "Financeiro",
    retencao: "5 anos (PR01); DELETE bloqueado por trigger.",
    rbac: "faturamento",
    gatilhos: "trg_faturamento_bu, trg_faturamento_bd, trg_aud_faturamento_ai, trg_aud_faturamento_au; evento ev_faturas_vencidas",
    colunas: [
      { n: "id_faturamento", d: "Identificador sequencial da fatura.", t: "INT UNSIGNED", c: "[PK] [AUTO_INCREMENT] [NOT NULL]", p: "NA", l: "Origem: gerado pelo SGBD. Destino: reserva.id_faturamento, pagamento (FK)." },
      { n: "id_medico", d: "Médico faturado; um por mês de referência.", t: "INT UNSIGNED", c: "[FK → medico.id_medico] [UK uk_faturamento_medico_mes (id_medico, data_referencia)] [NOT NULL] [ON DELETE RESTRICT] [ON UPDATE CASCADE]", p: "NA", l: "Origem: parâmetro de sp_fechar_faturamento (RF04). Destino: trg_medico_bu (RN07); sp_exportar_titular." },
      { n: "id_contrato", d: "Contrato que regeu o desconto e o vencimento da fatura.", t: "INT UNSIGNED", c: "[FK → contrato.id_contrato] [NOT NULL] [ON DELETE RESTRICT] [ON UPDATE CASCADE]", p: "NA", l: "Origem: sp_fechar_faturamento (contrato vigente no mês). Destino: relatórios financeiros." },
      { n: "data_referencia", d: "Primeiro dia do mês faturado.", t: "DATE", c: "[UK uk_faturamento_medico_mes] [NOT NULL] [CHECK ck_faturamento_referencia: DAY = 1]", p: "NA", l: "Origem: parâmetro de sp_fechar_faturamento. Destino: sp_exportar_titular." },
      { n: "valor_total", d: "Soma de valor_cobrado das reservas CONCLUIDA e CANCELADA com cobrança do mês, menos o desconto do contrato (RN05). Redundância controlada e congelada.", t: "DECIMAL(10,2)", c: "[NOT NULL] [CHECK ck_faturamento_valor: >= 0]", p: "NA", l: "Origem: calculado por sp_fechar_faturamento a partir de reserva, reserva_equipamento e contrato. Destino: trg_pagamento_bi/ai; sp_exportar_titular." },
      { n: "status_pagamento", d: "ABERTO ao fechar; PARCIAL ou PAGO conforme pagamentos (trg_pagamento_ai); VENCIDO pelo evento diário após data_vencimento.", t: "ENUM('ABERTO','PARCIAL','PAGO','VENCIDO')", c: "[NOT NULL] [DEFAULT 'ABERTO']", p: "NA", l: "Origem: trg_pagamento_ai; ev_faturas_vencidas. Destino: trg_medico_bu; log_auditoria." },
      { n: "data_vencimento", d: "dia_faturamento do contrato no mês seguinte ao de referência.", t: "DATE", c: "[NOT NULL]", p: "NA", l: "Origem: sp_fechar_faturamento. Destino: ev_faturas_vencidas; cobrança." },
      { n: "data_fechamento", d: "Instante do fechamento; marco para a retenção de 5 anos.", t: "DATETIME", c: "[NOT NULL] [DEFAULT CURRENT_TIMESTAMP]", p: "NA", l: "Origem: SGBD no INSERT. Destino: sp_anonimizar_titular (PR01)." }
    ]
  },

  /* ------------------------------------------------------------ reserva */
  {
    nome: "reserva",
    bloco: "transacional",
    finalidade: "Agendamento de uma sala por um médico em um intervalo do mesmo dia, com valor congelado e máquina de estados PENDENTE → CONFIRMADA → CONCLUIDA ou CANCELADA (RN08).",
    requisitos: "RF02, RF04, RF07, RF09 · RN01, RN02, RN03, RN04, RN08, RN09, RN10, RN12, RN13",
    owner: "Operações (Recepção)",
    retencao: "5 anos quando faturada (PR01); sem exclusão física.",
    rbac: "reserva",
    gatilhos: "trg_reserva_bi, trg_reserva_bu, trg_aud_reserva_ai, trg_aud_reserva_au; procedure sp_criar_reserva",
    colunas: [
      { n: "id_reserva", d: "Identificador sequencial da reserva.", t: "INT UNSIGNED", c: "[PK] [AUTO_INCREMENT] [NOT NULL]", p: "NA", l: "Origem: gerado pelo SGBD (sp_criar_reserva). Destino: reserva_equipamento (FK)." },
      { n: "id_medico", d: "Médico solicitante; deve estar ativo e com contrato ATIVO vigente na data (RN02, RN09).", t: "INT UNSIGNED", c: "[FK → medico.id_medico] [NOT NULL] [ON DELETE RESTRICT] [ON UPDATE CASCADE]", p: "NA", l: "Origem: RF02. Destino: sp_fechar_faturamento; agenda RF09 (oculto para terceiros)." },
      { n: "id_sala", d: "Sala reservada; deve estar ativa.", t: "INT UNSIGNED", c: "[FK → sala.id_sala] [NOT NULL] [ON DELETE RESTRICT] [ON UPDATE CASCADE]", p: "NA", l: "Origem: RF02. Destino: checagem de conflito (RN01); agenda RF09." },
      { n: "id_faturamento", d: "Fatura que consolidou a reserva. NULL até o fechamento; preenchido uma única vez (RN13).", t: "INT UNSIGNED", c: "[FK → faturamento.id_faturamento] [NULL] [ON DELETE RESTRICT] [ON UPDATE CASCADE]", p: "NA", l: "Origem: sp_fechar_faturamento. Destino: rastreio fatura ↔ reservas." },
      { n: "data_reserva", d: "Dia da utilização (data local). Início não pode estar no passado (RN12).", t: "DATE", c: "[NOT NULL]", p: "NA", l: "Origem: RF02. Destino: conflito RN01; fn_tarifa_vigente; faturamento." },
      { n: "hora_inicio", d: "Horário de início (local).", t: "TIME", c: "[NOT NULL] [CHECK ck_reserva_horario]", p: "NA", l: "Origem: RF02. Destino: conflito RN01; fn_valor_uso." },
      { n: "hora_fim", d: "Horário de término, maior que hora_inicio (sem atravessar a meia-noite); duração entre 30 min e 12 h.", t: "TIME", c: "[NOT NULL] [CHECK ck_reserva_horario: hora_fim > hora_inicio]", p: "NA", l: "Origem: RF02. Destino: conflito RN01; fn_valor_uso; conclusão RN13." },
      { n: "status", d: "Estado da reserva. Sempre nasce PENDENTE; CONCLUIDA e CANCELADA são finais.", t: "ENUM('PENDENTE','CONFIRMADA','CANCELADA','CONCLUIDA')", c: "[NOT NULL] [DEFAULT 'PENDENTE'] [CHECK ck_reserva_cancelamento]", p: "NA", l: "Origem: trg_reserva_bi; RF02 (confirmação); RF07. Destino: conflito RN01; sp_fechar_faturamento; log_auditoria." },
      { n: "valor_cobrado", d: "Valor da sala calculado no INSERT com a tarifa vigente; congelado (RN03). Redundância controlada.", t: "DECIMAL(10,2)", c: "[NOT NULL] [CHECK ck_reserva_valor: >= 0]", p: "NA", l: "Origem: trg_reserva_bi via fn_tarifa_vigente e fn_valor_uso. Destino: faturamento.valor_total; v_faturamento_medico_mes." },
      { n: "cobranca_cancelamento", d: "1 quando o cancelamento ocorreu a menos de 24 h do início: cobra 100% (RN10).", t: "BOOLEAN", c: "[NOT NULL] [DEFAULT 0] [CHECK ck_reserva_cobranca: 0 ou 1]", p: "NA", l: "Origem: trg_reserva_bu no cancelamento. Destino: sp_fechar_faturamento; v_faturamento_medico_mes." },
      { n: "data_criacao", d: "Instante do registro, definido pelo servidor e imutável.", t: "TIMESTAMP", c: "[NOT NULL] [DEFAULT CURRENT_TIMESTAMP]", p: "NA", l: "Origem: trg_reserva_bi. Destino: auditoria operacional." },
      { n: "data_confirmacao", d: "Instante da confirmação pela Recepção (RN04).", t: "DATETIME", c: "[NULL]", p: "NA", l: "Origem: trg_reserva_bu (PENDENTE → CONFIRMADA). Destino: indicadores operacionais." },
      { n: "data_cancelamento", d: "Instante do cancelamento; obrigatório se status = CANCELADA.", t: "DATETIME", c: "[NULL] [CHECK ck_reserva_cancelamento]", p: "NA", l: "Origem: trg_reserva_bu. Destino: cálculo de cobranca_cancelamento." },
      { n: "motivo_cancelamento", d: "Justificativa do cancelamento; obrigatória e não vazia (ERR-NEG-010). Não deve conter dados de pacientes (EN-01).", t: "VARCHAR(255)", c: "[NULL] [CHECK ck_reserva_cancelamento]", p: "NA", l: "Origem: RF07 (Recepção ou Médico). Destino: relatório de cancelamentos." }
    ]
  },

  /* ------------------------------------------------ reserva_equipamento */
  {
    nome: "reserva_equipamento",
    bloco: "transacional",
    finalidade: "Associativa entre reserva e equipamento, com valor congelado do equipamento. Inserida apenas enquanto a reserva está PENDENTE; imutável.",
    requisitos: "RF02, RF04, RF09 · RN01, RN03, RN09",
    owner: "Operações (Recepção)",
    retencao: "Acompanha a reserva.",
    rbac: "reserva",
    gatilhos: "trg_resequip_bi, trg_resequip_bu, trg_aud_resequip_ai",
    colunas: [
      { n: "id_reserva_equipamento", d: "Identificador sequencial do vínculo.", t: "INT UNSIGNED", c: "[PK] [AUTO_INCREMENT] [NOT NULL]", p: "NA", l: "Origem: gerado pelo SGBD. Destino: log_auditoria." },
      { n: "id_reserva", d: "Reserva à qual o equipamento é alocado; par (id_reserva, id_equipamento) é único.", t: "INT UNSIGNED", c: "[FK → reserva.id_reserva] [UK uk_reserva_equipamento (id_reserva, id_equipamento)] [NOT NULL] [ON DELETE RESTRICT] [ON UPDATE CASCADE]", p: "NA", l: "Origem: sp_criar_reserva. Destino: faturamento; conflito RN01." },
      { n: "id_equipamento", d: "Equipamento alocado; deve estar ativo e livre no intervalo.", t: "INT UNSIGNED", c: "[FK → equipamento.id_equipamento] [UK uk_reserva_equipamento] [NOT NULL] [ON DELETE RESTRICT] [ON UPDATE CASCADE]", p: "NA", l: "Origem: parâmetro JSON de sp_criar_reserva. Destino: conflito RN01; agenda RF09." },
      { n: "valor_cobrado", d: "Valor do equipamento calculado no INSERT com a tarifa vigente; congelado (RN03).", t: "DECIMAL(10,2)", c: "[NOT NULL] [CHECK ck_resequip_valor: >= 0]", p: "NA", l: "Origem: trg_resequip_bi via fn_tarifa_vigente e fn_valor_uso. Destino: faturamento.valor_total; v_faturamento_medico_mes." }
    ]
  },

  /* ---------------------------------------------------------- pagamento */
  {
    nome: "pagamento",
    bloco: "transacional",
    finalidade: "Baixas totais ou parciais de uma fatura. O sistema registra a baixa, não processa o pagamento (EN-04). Imutável.",
    requisitos: "RF08 · RN06 · PR01",
    owner: "Financeiro",
    retencao: "5 anos (PR01); UPDATE bloqueado.",
    rbac: "pagamento",
    gatilhos: "trg_pagamento_bi, trg_pagamento_ai, trg_pagamento_bu, trg_aud_pagamento_ai",
    colunas: [
      { n: "id_pagamento", d: "Identificador sequencial do pagamento.", t: "INT UNSIGNED", c: "[PK] [AUTO_INCREMENT] [NOT NULL]", p: "NA", l: "Origem: gerado pelo SGBD. Destino: log_auditoria." },
      { n: "id_faturamento", d: "Fatura quitada, total ou parcialmente.", t: "INT UNSIGNED", c: "[FK → faturamento.id_faturamento] [NOT NULL] [ON DELETE RESTRICT] [ON UPDATE CASCADE]", p: "NA", l: "Origem: RF08 (Financeiro). Destino: trg_pagamento_ai (status_pagamento)." },
      { n: "valor_pago", d: "Valor recebido, maior que zero; a soma por fatura não pode exceder valor_total (ERR-VAL-002).", t: "DECIMAL(10,2)", c: "[NOT NULL] [CHECK ck_pagamento_valor: > 0]", p: "NA", l: "Origem: RF08. Destino: faturamento.status_pagamento." },
      { n: "forma_pagamento", d: "Meio de pagamento informado na baixa.", t: "ENUM('PIX','BOLETO','TRANSFERENCIA','CARTAO','DINHEIRO')", c: "[NOT NULL]", p: "NA", l: "Origem: RF08. Destino: log_auditoria; relatórios financeiros." },
      { n: "data_pagamento", d: "Data em que o valor foi recebido.", t: "DATE", c: "[NOT NULL]", p: "NA", l: "Origem: RF08. Destino: relatórios financeiros." }
    ]
  },

  /* ------------------------------------------------------ log_auditoria */
  {
    nome: "log_auditoria",
    bloco: "auditoria",
    finalidade: "Trilha de auditoria append-only das operações de INSERT, UPDATE e inativação, gravada por triggers AFTER. UPDATE e DELETE bloqueados.",
    requisitos: "RF10, RF11 · RNF01, RNF10, RNF12",
    owner: "Administração (TI / Segurança)",
    retencao: "5 anos (PR01, RNF12).",
    rbac: "auditoria",
    gatilhos: "trg_log_bu, trg_log_bd",
    colunas: [
      { n: "id_log_auditoria", d: "Identificador sequencial do evento auditado.", t: "BIGINT UNSIGNED", c: "[PK] [AUTO_INCREMENT] [NOT NULL]", p: "NA", l: "Origem: gerado pelo SGBD. Destino: consulta RF10." },
      { n: "id_usuario", d: "Autor da operação, lido da variável de sessão @id_usuario_app. NULL = processo automático ou variável não definida.", t: "INT UNSIGNED", c: "[FK → usuario.id_usuario] [NULL] [ON DELETE RESTRICT] [ON UPDATE CASCADE]", p: "NA", l: "Origem: @id_usuario_app definida pela aplicação. Destino: RF10 (filtro por usuário)." },
      { n: "tabela_afetada", d: "Nome da tabela de origem do evento.", t: "VARCHAR(64)", c: "[NOT NULL] [INDEX ix_log_registro]", p: "NA", l: "Origem: triggers trg_aud_*. Destino: RF10 (filtro por tabela)." },
      { n: "id_registro_afetado", d: "Chave primária do registro afetado.", t: "BIGINT UNSIGNED", c: "[NOT NULL] [INDEX ix_log_registro]", p: "NA", l: "Origem: NEW.id_<entidade> nos triggers. Destino: RF10." },
      { n: "operacao", d: "Tipo de evento: INSERT, UPDATE ou INATIVACAO (ativo 1 → 0, contrato saindo de ATIVO ou reserva CANCELADA).", t: "ENUM('INSERT','UPDATE','INATIVACAO')", c: "[NOT NULL]", p: "NA", l: "Origem: triggers trg_aud_*. Destino: RF10." },
      { n: "valor_anterior", d: "Recorte JSON dos campos antes da alteração; sem CPF ou telefone em claro.", t: "JSON", c: "[NULL]", p: "DP", l: "Origem: OLD.* nos triggers AFTER UPDATE. Destino: RF10.", r: "Somente Administrador (R). Pode conter CRM e situação do médico." },
      { n: "valor_novo", d: "Recorte JSON dos campos após a operação; sem CPF ou telefone em claro.", t: "JSON", c: "[NULL]", p: "DP", l: "Origem: NEW.* nos triggers AFTER INSERT/UPDATE. Destino: RF10.", r: "Somente Administrador (R). Pode conter CRM e situação do médico." },
      { n: "data_hora", d: "Instante do evento, definido pelo servidor.", t: "TIMESTAMP", c: "[NOT NULL] [DEFAULT CURRENT_TIMESTAMP] [INDEX ix_log_data]", p: "NA", l: "Origem: SGBD. Destino: RF10 (filtro por período); retenção RNF12." }
    ]
  },

  /* ---------------------------------------------------- registro_acesso */
  {
    nome: "registro_acesso",
    bloco: "auditoria",
    finalidade: "Registros de tentativas de login (sucesso, falha, bloqueio) exigidos pelo Marco Civil da Internet (PR04).",
    requisitos: "RF06, RF10 · PR04 · RNF01, RNF12",
    owner: "Administração (TI / Segurança)",
    retencao: "6 meses (PR04, RNF12).",
    rbac: "auditoria",
    gatilhos: "Sem triggers.",
    colunas: [
      { n: "id_registro_acesso", d: "Identificador sequencial da tentativa.", t: "BIGINT UNSIGNED", c: "[PK] [AUTO_INCREMENT] [NOT NULL]", p: "NA", l: "Origem: gerado pelo SGBD. Destino: RF10." },
      { n: "id_usuario", d: "Usuário identificado pelo login. NULL quando o login informado não existe.", t: "INT UNSIGNED", c: "[FK → usuario.id_usuario] [NULL] [ON DELETE RESTRICT] [ON UPDATE CASCADE] [INDEX ix_acesso_usuario_data]", p: "NA", l: "Origem: serviço de autenticação. Destino: RF10." },
      { n: "login_informado", d: "Texto digitado no campo de login, inclusive quando inválido.", t: "VARCHAR(50)", c: "[NOT NULL]", p: "DP", l: "Origem: tela de login. Destino: RF10; alerta RNF12." },
      { n: "endereco_ip", d: "Endereço IPv4 ou IPv6 de origem da tentativa.", t: "VARCHAR(45)", c: "[NOT NULL]", p: "DP", l: "Origem: requisição HTTP (servidor de aplicação). Destino: RF10; requisição judicial (PR04)." },
      { n: "resultado", d: "Desfecho da tentativa.", t: "ENUM('SUCESSO','FALHA','BLOQUEADO')", c: "[NOT NULL]", p: "NA", l: "Origem: serviço de autenticação. Destino: usuario.tentativas_falha; RF10." },
      { n: "data_hora", d: "Instante da tentativa, definido pelo servidor.", t: "TIMESTAMP", c: "[NOT NULL] [DEFAULT CURRENT_TIMESTAMP] [INDEX ix_acesso_data]", p: "NA", l: "Origem: SGBD. Destino: RF10; retenção de 6 meses." }
    ]
  },

  /* ------------------------------------------------ solicitacao_titular */
  {
    nome: "solicitacao_titular",
    bloco: "auditoria",
    finalidade: "Pedidos de médicos titulares de dados (LGPD, art. 18): acesso, correção, anonimização, portabilidade ou eliminação, com prazo de resposta.",
    requisitos: "RF11 · PR01, PR02, PR05",
    owner: "Privacidade (Encarregado/DPO)",
    retencao: "5 anos, como prova de atendimento (inferido de PR05).",
    rbac: "solicitacao",
    gatilhos: "trg_solicitacao_bi, trg_aud_solicitacao_ai, trg_aud_solicitacao_au; procedures sp_anonimizar_titular, sp_exportar_titular",
    colunas: [
      { n: "id_solicitacao_titular", d: "Identificador sequencial da solicitação.", t: "INT UNSIGNED", c: "[PK] [AUTO_INCREMENT] [NOT NULL]", p: "NA", l: "Origem: gerado pelo SGBD. Destino: sp_anonimizar_titular." },
      { n: "id_medico", d: "Médico titular que fez o pedido.", t: "INT UNSIGNED", c: "[FK → medico.id_medico] [NOT NULL] [ON DELETE RESTRICT] [ON UPDATE CASCADE]", p: "NA", l: "Origem: RF11 (Recepção registra). Destino: sp_anonimizar_titular; sp_exportar_titular." },
      { n: "tipo", d: "Direito exercido pelo titular.", t: "ENUM('ACESSO','CORRECAO','ANONIMIZACAO','PORTABILIDADE','ELIMINACAO')", c: "[NOT NULL]", p: "NA", l: "Origem: RF11. Destino: roteamento do atendimento; log_auditoria." },
      { n: "status", d: "Situação do pedido; sempre nasce ABERTA. NEGADA exige justificativa.", t: "ENUM('ABERTA','EM_ANALISE','ATENDIDA','NEGADA')", c: "[NOT NULL] [DEFAULT 'ABERTA'] [CHECK ck_solicitacao_negada]", p: "NA", l: "Origem: trg_solicitacao_bi; RF11 (Administrador); sp_anonimizar_titular. Destino: log_auditoria." },
      { n: "justificativa", d: "Fundamento da resposta; obrigatória quando NEGADA (ex.: retenção de 5 anos, PR01).", t: "VARCHAR(500)", c: "[NULL] [CHECK ck_solicitacao_negada: NEGADA exige valor]", p: "DP", l: "Origem: RF11; sp_anonimizar_titular. Destino: resposta ao titular." },
      { n: "data_solicitacao", d: "Instante do registro do pedido, definido pelo servidor.", t: "DATETIME", c: "[NOT NULL] [DEFAULT CURRENT_TIMESTAMP]", p: "NA", l: "Origem: trg_solicitacao_bi. Destino: controle de prazo." },
      { n: "data_prazo", d: "Data-limite de resposta: data local do registro + 15 dias (PR05).", t: "DATE", c: "[NOT NULL]", p: "NA", l: "Origem: calculado por trg_solicitacao_bi. Destino: acompanhamento de prazos; log_auditoria." },
      { n: "data_resposta", d: "Instante em que o pedido foi atendido ou negado.", t: "DATETIME", c: "[NULL]", p: "NA", l: "Origem: RF11; sp_anonimizar_titular. Destino: indicador de cumprimento de prazo." }
    ]
  }
];

/* ---------------------------------------------------------------------
   3. Objetos programáveis (rotinas, view e evento do DDL)
   --------------------------------------------------------------------- */
const OBJETOS = [
  { nome: "fn_agora_local()", tipo: "FUNCTION", desc: "Retorna UTC - 3 h (America/Sao_Paulo, sem horário de verão). Base das validações de data e hora local." },
  { nome: "fn_tarifa_vigente(sala, equipamento, data)", tipo: "FUNCTION", desc: "Lê historico_tarifa e devolve a tarifa válida na data para a sala ou o equipamento." },
  { nome: "fn_valor_uso(unidade, tarifa, inicio, fim)", tipo: "FUNCTION", desc: "Calcula o valor: HORA por frações de 30 min arredondadas para cima; PERIODO por blocos de 4 h (ERR-NEG-004 se não for múltiplo)." },
  { nome: "sp_criar_reserva", tipo: "PROCEDURE", desc: "Bloqueia sala e equipamentos (FOR UPDATE, ordem crescente de id) e grava reserva e reserva_equipamento em uma transação (RNF05, RNF08)." },
  { nome: "sp_fechar_faturamento", tipo: "PROCEDURE", desc: "Fecha a fatura do médico para um mês encerrado, aplica o desconto do contrato e vincula as reservas cobradas (RN05, RN13)." },
  { nome: "sp_anonimizar_titular", tipo: "PROCEDURE", desc: "Atende ANONIMIZACAO ou ELIMINACAO: nega antes de 5 anos da última fatura (ERR-NEG-015); depois anula CPF e telefones e anonimiza o usuário." },
  { nome: "sp_exportar_titular", tipo: "PROCEDURE", desc: "Gera o JSON de acesso e portabilidade do médico: cadastro, especialidades, contratos, reservas e faturas." },
  { nome: "v_faturamento_medico_mes", tipo: "VIEW", desc: "Bruto mensal por médico (salas, equipamentos e total) das reservas cobráveis; base de conferência da RN05." },
  { nome: "ev_faturas_vencidas", tipo: "EVENT", desc: "Diariamente, marca como VENCIDO as faturas ABERTO ou PARCIAL com data_vencimento anterior à data local. Requer event_scheduler = ON." }
];

/* =====================================================================
   4. Renderização
   ===================================================================== */
const PRIV = {
  DPS: { rotulo: "DPS", titulo: "Dado pessoal sensível (LGPD, art. 5º, II)" },
  DP: { rotulo: "DP", titulo: "Dado pessoal (LGPD, art. 5º, I)" },
  NA: { rotulo: "N/A", titulo: "Não aplicável: não identifica pessoa natural" }
};

const ROTULO_PERFIL = { MEDICO: "Médico", RECEPCAO: "Recepção", FINANCEIRO: "Financeiro", ADMINISTRADOR: "Administrador" };

function el(tag, attrs, html) {
  const node = document.createElement(tag);
  if (attrs) {
    Object.keys(attrs).forEach(function (k) { node.setAttribute(k, attrs[k]); });
  }
  if (html !== undefined) node.innerHTML = html;
  return node;
}

function esc(texto) {
  return String(texto)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* Destaca os marcadores [PK], [FK ...], [UK ...] etc. */
function formatarConstraints(texto) {
  return esc(texto).replace(/\[([^\]]+)\]/g, function (_m, conteudo) {
    let classe = "ct";
    if (/^PK/.test(conteudo)) classe += " ct-pk";
    else if (/^FK/.test(conteudo)) classe += " ct-fk";
    else if (/^UK/.test(conteudo)) classe += " ct-uk";
    else if (/^NOT NULL/.test(conteudo)) classe += " ct-nn";
    else if (/^NULL/.test(conteudo)) classe += " ct-null";
    return '<span class="' + classe + '">[' + conteudo + "]</span>";
  });
}

function textoAcesso(tabela, coluna) {
  if (coluna.r) return esc(coluna.r);
  const regra = RBAC[tabela.rbac];
  return PERFIS.map(function (perfil) {
    const v = regra[perfil];
    return '<span class="rbac-linha' + (v === "-" ? " rbac-nenhum" : "") + '"><b>' +
      ROTULO_PERFIL[perfil] + ":</b> " + esc(v === "-" ? "sem acesso" : v) + "</span>";
  }).join("");
}

function renderIdentificacao() {
  document.getElementById("escopo-texto").textContent = PROJETO.escopo;

  const tec = document.getElementById("tecnologia-lista");
  PROJETO.tecnologia.forEach(function (par) {
    tec.appendChild(el("dt", null, esc(par[0])));
    tec.appendChild(el("dd", null, esc(par[1])));
  });

  const lista = document.getElementById("responsaveis-lista");
  PROJETO.responsaveis.forEach(function (p) {
    const li = el("li", { class: "pessoa" });
    li.innerHTML =
      '<span class="pessoa-papel">' + esc(p.papel) + "</span>" +
      '<span class="pessoa-nome">' + esc(p.nome) + (p.ra ? ' <small>RA ' + esc(p.ra) + "</small>" : "") + "</span>" +
      '<span class="pessoa-resp">' + esc(p.resp) + "</span>";
    lista.appendChild(li);
  });

  /* Indicadores calculados a partir do próprio dicionário */
  let totalColunas = 0, dp = 0, dps = 0, fk = 0;
  TABELAS.forEach(function (t) {
    totalColunas += t.colunas.length;
    t.colunas.forEach(function (c) {
      if (c.p === "DP") dp++;
      if (c.p === "DPS") dps++;
      if (/\[FK/.test(c.c)) fk++;
    });
  });
  const ind = document.getElementById("indicadores");
  [
    [TABELAS.length, "tabelas"],
    [totalColunas, "colunas"],
    [fk, "chaves estrangeiras"],
    [dp, "colunas com dado pessoal"],
    [dps, "colunas com dado sensível"]
  ].forEach(function (par) {
    ind.appendChild(el("li", null, "<strong>" + par[0] + "</strong> " + par[1]));
  });
}

function renderNavegacao() {
  const nav = document.getElementById("nav-tabelas");
  Object.keys(BLOCOS).forEach(function (chave) {
    const grupo = el("div", { class: "nav-grupo bloco-" + chave });
    grupo.appendChild(el("p", { class: "nav-grupo-titulo" }, esc(BLOCOS[chave])));
    const ul = el("ul");
    TABELAS.filter(function (t) { return t.bloco === chave; }).forEach(function (t) {
      const li = el("li", { "data-tabela": t.nome });
      li.innerHTML = '<a href="#' + t.nome + '">' + esc(t.nome) + '<span class="nav-qtd">' + t.colunas.length + "</span></a>";
      ul.appendChild(li);
    });
    grupo.appendChild(ul);
    nav.appendChild(grupo);
  });
  const extra = el("div", { class: "nav-grupo" });
  extra.innerHTML = '<p class="nav-grupo-titulo">Outros objetos</p><ul><li data-tabela="objetos-programaveis"><a href="#objetos-programaveis">Rotinas, view e evento<span class="nav-qtd">' + OBJETOS.length + "</span></a></li></ul>";
  nav.appendChild(extra);
}

function renderDicionario() {
  const area = document.getElementById("dicionario");
  TABELAS.forEach(function (t) {
    const sec = el("section", { id: t.nome, class: "tabela-dd bloco-" + t.bloco, "data-tabela": t.nome });

    const cab = el("header", { class: "tabela-cab" });
    cab.innerHTML =
      '<div class="placa"><span class="placa-bloco">' + esc(BLOCOS[t.bloco]) + "</span>" +
      '<h3 class="placa-nome">' + esc(t.nome) + "</h3></div>" +
      '<p class="tabela-finalidade">' + esc(t.finalidade) + "</p>" +
      '<dl class="tabela-meta">' +
      "<div><dt>Rastreabilidade</dt><dd>" + esc(t.requisitos) + "</dd></div>" +
      "<div><dt>Owner de negócio</dt><dd>" + esc(t.owner) + "</dd></div>" +
      "<div><dt>Retenção</dt><dd>" + esc(t.retencao) + "</dd></div>" +
      "<div><dt>Triggers e rotinas</dt><dd><code>" + esc(t.gatilhos) + "</code></dd></div>" +
      "</dl>";
    sec.appendChild(cab);

    const wrap = el("div", { class: "tabela-wrap", tabindex: "0", role: "region", "aria-label": "Colunas da tabela " + t.nome });
    const tbl = el("table", { class: "dd" });
    tbl.innerHTML =
      "<caption class=\"sr-only\">Dicionário da tabela " + esc(t.nome) + "</caption>" +
      "<thead><tr>" +
      '<th scope="col">Atributo</th>' +
      '<th scope="col">Descrição / Regra de Negócio</th>' +
      '<th scope="col">Tipo e Tamanho</th>' +
      '<th scope="col">Constraints</th>' +
      '<th scope="col">Privacidade (LGPD/GDPR)</th>' +
      '<th scope="col">Linhagem (Data Lineage)</th>' +
      '<th scope="col">Controle de Acesso (RBAC)</th>' +
      "</tr></thead>";
    const tbody = el("tbody");
    t.colunas.forEach(function (c) {
      const tr = el("tr", { "data-busca": (t.nome + " " + c.n).toLowerCase() });
      const priv = PRIV[c.p];
      tr.innerHTML =
        '<td data-rotulo="Atributo"><div class="cel"><code class="atributo">' + esc(c.n) + "</code></div></td>" +
        '<td data-rotulo="Descrição"><div class="cel">' + esc(c.d) + "</div></td>" +
        '<td data-rotulo="Tipo"><div class="cel"><code class="tipo">' + esc(c.t) + "</code></div></td>" +
        '<td data-rotulo="Constraints"><div class="cel">' + formatarConstraints(c.c) + "</div></td>" +
        '<td data-rotulo="Privacidade"><div class="cel"><span class="badge badge-' + c.p.toLowerCase() + '" title="' + esc(priv.titulo) + '">' + priv.rotulo + "</span></div></td>" +
        '<td data-rotulo="Linhagem"><div class="cel">' + esc(c.l) + "</div></td>" +
        '<td data-rotulo="Acesso" class="rbac"><div class="cel">' + textoAcesso(t, c) + "</div></td>";
      tbody.appendChild(tr);
    });
    tbl.appendChild(tbody);
    wrap.appendChild(tbl);
    sec.appendChild(wrap);
    area.appendChild(sec);
  });

  /* Rotinas, view e evento */
  const sec = el("section", { id: "objetos-programaveis", class: "tabela-dd", "data-tabela": "objetos-programaveis" });
  sec.innerHTML =
    '<header class="tabela-cab"><div class="placa"><span class="placa-bloco">Lógica no banco</span>' +
    '<h3 class="placa-nome">Rotinas, view e evento</h3></div>' +
    '<p class="tabela-finalidade">Objetos que calculam ou transformam dados das tabelas acima. Os triggers de cada tabela estão listados no cabeçalho dela.</p></header>';
  const wrap = el("div", { class: "tabela-wrap", tabindex: "0", role: "region", "aria-label": "Objetos programáveis" });
  const tbl = el("table", { class: "dd dd-objetos" });
  tbl.innerHTML = '<thead><tr><th scope="col">Objeto</th><th scope="col">Tipo</th><th scope="col">Finalidade</th></tr></thead>';
  const tbody = el("tbody");
  OBJETOS.forEach(function (o) {
    const tr = el("tr", { "data-busca": ("objetos " + o.nome + " " + o.tipo).toLowerCase() });
    tr.innerHTML = '<td data-rotulo="Objeto"><div class="cel"><code class="atributo">' + esc(o.nome) + '</code></div></td><td data-rotulo="Tipo"><div class="cel">' + esc(o.tipo) + '</div></td><td data-rotulo="Finalidade"><div class="cel">' + esc(o.desc) + "</div></td>";
    tbody.appendChild(tr);
  });
  tbl.appendChild(tbody);
  wrap.appendChild(tbl);
  sec.appendChild(wrap);
  area.appendChild(sec);
}

/* ---------------------------------------------------------------------
   5. Busca em tempo real (nome da tabela ou da coluna)
   --------------------------------------------------------------------- */
function normalizar(s) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function aplicarBusca(termoBruto) {
  const termo = normalizar(termoBruto.trim());
  let secoesVisiveis = 0, linhasVisiveis = 0;

  document.querySelectorAll(".tabela-dd").forEach(function (sec) {
    const nomeTabela = normalizar(sec.getAttribute("data-tabela"));
    const tabelaCasa = termo === "" || nomeTabela.indexOf(termo) !== -1;
    let algumaLinha = false;

    sec.querySelectorAll("tbody tr").forEach(function (tr) {
      const casa = tabelaCasa || normalizar(tr.getAttribute("data-busca")).indexOf(termo) !== -1;
      tr.hidden = !casa;
      if (casa) { algumaLinha = true; linhasVisiveis++; }
    });

    const visivel = tabelaCasa || algumaLinha;
    sec.hidden = !visivel;
    if (visivel) secoesVisiveis++;

    const itemNav = document.querySelector('.nav-tabelas li[data-tabela="' + sec.getAttribute("data-tabela") + '"]');
    if (itemNav) itemNav.classList.toggle("nav-oculto", !visivel);
  });

  const status = document.getElementById("busca-status");
  const vazio = document.getElementById("busca-vazia");
  if (termo === "") {
    status.textContent = "";
    vazio.hidden = true;
  } else {
    status.textContent = secoesVisiveis + " seção(ões) e " + linhasVisiveis + " linha(s) correspondem a “" + termoBruto.trim() + "”.";
    vazio.hidden = secoesVisiveis !== 0;
  }
}

/* ---------------------------------------------------------------------
   6. Tema claro/escuro (preferência guardada quando o navegador permite)
   --------------------------------------------------------------------- */
function lerTema() {
  try { return localStorage.getItem("dd-tema"); } catch (e) { return null; }
}
function gravarTema(valor) {
  try { localStorage.setItem("dd-tema", valor); } catch (e) { /* armazenamento indisponível */ }
}
function aplicarTema(tema) {
  document.documentElement.setAttribute("data-tema", tema);
  const botao = document.getElementById("btn-tema");
  const escuro = tema === "escuro";
  botao.setAttribute("aria-pressed", String(escuro));
  botao.querySelector("i").className = escuro ? "fa-solid fa-sun" : "fa-solid fa-moon";
  botao.querySelector("span").textContent = escuro ? "Modo claro" : "Modo escuro";
}

/* ---------------------------------------------------------------------
   7. Modal do DER com Panzoom (zoom por scroll, arraste, botões)
   --------------------------------------------------------------------- */
let panzoom = null;

function abrirDer() {
  const modal = document.getElementById("modal-der");
  const img = document.getElementById("der-img");
  modal.hidden = false;
  document.body.classList.add("modal-aberto");
  document.getElementById("der-fechar").focus();

  if (!panzoom && typeof Panzoom === "function") {
    panzoom = Panzoom(img, { maxScale: 8, minScale: 0.3, step: 0.3, canvas: true, cursor: "grab" });
    img.parentElement.addEventListener("wheel", function (ev) {
      ev.preventDefault();
      panzoom.zoomWithWheel(ev);
    }, { passive: false });
  }
  if (!panzoom) {
    document.getElementById("der-aviso").hidden = false;
  }
}

function fecharDer() {
  document.getElementById("modal-der").hidden = true;
  document.body.classList.remove("modal-aberto");
  document.getElementById("btn-der").focus();
}

/* ---------------------------------------------------------------------
   8. Inicialização
   --------------------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", function () {
  renderIdentificacao();
  renderNavegacao();
  renderDicionario();

  /* Tema */
  let tema = lerTema();
  if (!tema) tema = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "escuro" : "claro";
  aplicarTema(tema);
  document.getElementById("btn-tema").addEventListener("click", function () {
    const novo = document.documentElement.getAttribute("data-tema") === "escuro" ? "claro" : "escuro";
    aplicarTema(novo);
    gravarTema(novo);
  });

  /* Busca */
  const busca = document.getElementById("busca");
  busca.addEventListener("input", function () { aplicarBusca(busca.value); });
  document.getElementById("busca-limpar").addEventListener("click", function () {
    busca.value = "";
    aplicarBusca("");
    busca.focus();
  });

  /* Sidebar responsiva */
  const sidebar = document.getElementById("sidebar");
  const btnMenu = document.getElementById("btn-menu");
  const fundo = document.getElementById("sidebar-fundo");
  function alternarMenu(abrir) {
    sidebar.classList.toggle("aberta", abrir);
    fundo.hidden = !abrir;
    btnMenu.setAttribute("aria-expanded", String(abrir));
  }
  btnMenu.addEventListener("click", function () { alternarMenu(!sidebar.classList.contains("aberta")); });
  fundo.addEventListener("click", function () { alternarMenu(false); });
  sidebar.addEventListener("click", function (ev) {
    if (ev.target.closest("a") && window.matchMedia("(max-width: 960px)").matches) alternarMenu(false);
  });

  /* Item ativo na navegação */
  if ("IntersectionObserver" in window) {
    const obs = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (e) {
        if (e.isIntersecting) {
          document.querySelectorAll(".nav-tabelas li").forEach(function (li) {
            li.classList.toggle("ativo", li.getAttribute("data-tabela") === e.target.id);
          });
        }
      });
    }, { rootMargin: "-20% 0px -70% 0px" });
    document.querySelectorAll(".tabela-dd").forEach(function (s) { obs.observe(s); });
  }

  /* Modal do DER */
  document.getElementById("btn-der").addEventListener("click", abrirDer);
  document.getElementById("der-fechar").addEventListener("click", fecharDer);
  document.getElementById("der-zoom-in").addEventListener("click", function () { if (panzoom) panzoom.zoomIn(); });
  document.getElementById("der-zoom-out").addEventListener("click", function () { if (panzoom) panzoom.zoomOut(); });
  document.getElementById("der-reset").addEventListener("click", function () { if (panzoom) panzoom.reset(); });
  document.addEventListener("keydown", function (ev) {
    if (document.getElementById("modal-der").hidden) return;
    if (ev.key === "Escape") fecharDer();
    if (ev.key === "+" || ev.key === "=") { if (panzoom) panzoom.zoomIn(); }
    if (ev.key === "-") { if (panzoom) panzoom.zoomOut(); }
    if (ev.key === "0") { if (panzoom) panzoom.reset(); }
  });

  document.getElementById("ano").textContent = String(new Date().getFullYear());
});

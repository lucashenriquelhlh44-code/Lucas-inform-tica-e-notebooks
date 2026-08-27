const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const db = new sqlite3.Database('./banco.db');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Lista de clientes conectados esperando notificações
let clientesSSE = [];

// Criar tabela de Ordens de Serviço se não existir
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS ordem_servico (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente_nome TEXT,
      cliente_cpf TEXT,
      cliente_telefone TEXT,
      cliente_email TEXT,
      cep TEXT,
      rua TEXT,
      numero TEXT,
      bairro TEXT,
      cidade TEXT,
      equipamento_modelo TEXT,
      numero_serie TEXT,
      senha_windows TEXT,
      acessorios TEXT,
      defeito_relatado TEXT,
      status_os TEXT DEFAULT 'Em Análise',
      data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

// Rota SSE para notificações em tempo real
app.get('/api/notificacoes', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  clientesSSE.push(res);

  req.on('close', () => {
    clientesSSE = clientesSSE.filter(cliente => cliente !== res);
  });
});

// Função para avisar todos os painéis abertos
function notificarNovosClientes(dadosOrdem) {
  clientesSSE.forEach(cliente => {
    cliente.write(`data: ${JSON.stringify(dadosOrdem)}\n\n`);
  });
}

// Rota para cadastrar nova ordem
app.post('/api/os', (req, res) => {
  const {
    cliente_nome, cliente_cpf, cliente_telefone, cliente_email,
    cep, rua, numero, bairro, cidade,
    equipamento_modelo, numero_serie, senha_windows, acessorios, defeito_relatado
  } = req.body;

  const sql = `
    INSERT INTO ordem_servico (
      cliente_nome, cliente_cpf, cliente_telefone, cliente_email,
      cep, rua, numero, bairro, cidade,
      equipamento_modelo, numero_serie, senha_windows, acessorios, defeito_relatado
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const params = [
    cliente_nome, cliente_cpf, cliente_telefone, cliente_email,
    cep, rua, numero, bairro, cidade,
    equipamento_modelo, numero_serie, senha_windows, acessorios, defeito_relatado
  ];

  db.run(sql, params, function (err) {
    if (err) {
      console.error("Erro ao salvar ordem:", err.message);
      return res.status(500).json({ error: err.message });
    }

    const novaOrdem = {
      id: this.lastID,
      cliente_nome,
      equipamento_modelo
    };

    // Dispara o aviso em tempo real
    notificarNovosClientes(novaOrdem);

    console.log("Nova ordem cadastrada com ID:", this.lastID);
    res.json({ success: true, id: this.lastID });
  });
});

// Rota para listar todas as ordens de serviço
app.get('/api/ordens', (req, res) => {
  db.all("SELECT * FROM ordem_servico", [], (err, rows) => {
    if (err) {
      console.error("Erro ao buscar ordens:", err.message);
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

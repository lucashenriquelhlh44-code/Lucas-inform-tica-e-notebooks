const express = require('express');


const sqlite3 = require('sqlite3').verbose();


const dotenv = require('dotenv');


const { MercadoPagoConfig, Payment } = require('mercadopago');


const path = require('path');



dotenv.config();


const app = express();

app.use(express.json());



app.use(express.static(path.join(__dirname, 'public')));


// Inicialização do Banco de Dados SQLite
const db = new sqlite3.Database('./lucas_informatica.db', (err) => {
  if (err) {
    console.error("Erro ao abrir banco de dados:", err.message);
  } else {
    console.log("Banco de Dados SQLite conectado com sucesso.");
  }
});



// Criação da Tabela de Ordens de Serviço (Tabela completa baseada no modelo original)


db.serialize(() => {


db.run(`


CREATE TABLE IF NOT EXISTS ordem_servico (


id INTEGER PRIMARY KEY AUTOINCREMENT,


data_entrada DATETIME DEFAULT CURRENT_TIMESTAMP,


cliente_nome TEXT NOT NULL,


cliente_cpf_cnpj TEXT NOT NULL,


cliente_telefone TEXT NOT NULL,


cliente_email TEXT NOT NULL,


equipamento_modelo TEXT NOT NULL,


numero_serie TEXT,


senha_acesso TEXT,


acessorios TEXT,


defeito_relatado TEXT NOT NULL,


status_os TEXT DEFAULT 'Em Análise',


status_pagamento TEXT DEFAULT 'Pendente'


)


`);


});


// Configuração do Gateway Mercado Pago


const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN


|| 'SUA_CHAVE_AQUI' });


const payment = new Payment(client);


// Endpoint 1: Cadastrar Ordem de Serviço (Grava no Banco de Dados)


app.post('/api/os', (req, res) => {


const { nome, cpf, telefone, email, modelo, num_serie, senha, acessorios, defeito } =


req.body;


const query = `INSERT INTO ordem_servico


(cliente_nome, cliente_cpf_cnpj, cliente_telefone, cliente_email, equipamento_modelo,


numero_serie, senha_acesso, acessorios, defeito_relatado)VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;


db.run(query, [nome, cpf, telefone, email, modelo, num_serie, senha,


JSON.stringify(acessorios), defeito], function(err) {


if (err) {


console.error(err);


return res.status(500).json({ success: false, error: err.message });


}


res.json({ success: true, os_id: this.lastID, message: "Ordem de serviço aberta com sucesso!" });


});


});


// Endpoint 2: Processar Pagamento via PIX/Gateway


app.post('/api/checkout', async (req, res) => {


try {


const { item_titulo, valor, email_cliente, cpf_cliente } = req.body;


const body = {


transaction_amount: Number(valor),


description: item_titulo,


payment_method_id: 'pix',


payer: {


email: email_cliente,


identification: { type: 'CPF', number: cpf_cliente.replace(/\D/g, '') }


}


};


const response = await payment.create({ body });


res.json({


id_transacao: response.id,


qr_code: response.point_of_interaction.transaction_data.qr_code,


qr_code_base64: response.point_of_interaction.transaction_data.qr_code_base64


});


} catch (error) {


console.error(error);


res.status(500).json({ error: error.message });


}


});

// Rota para listar todas as ordens de serviço cadastradas
app.get('/api/ordens', (req, res) => {
  db.all("SELECT * FROM ordem_servico", [], (err, rows) => {
    if (err) {
      return res.status(500).json({ erro: err.message });
    }
    res.json(rows);
  });
});

const PORT = process.env.PORT || 3000;


app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));


const express = require('express');
const mysql = require ('mysql2/promise');
const cors = require('cors'); // Importa o cors

const app = express();
app.disable("x-powered-by");

app.use(cors()); // Aplica o cors a todas as rotas
app.use(express.json());

const pool = mysql.createPool({
  host: '127.0.0.1',
  user: 'root',
  password: '',
  database: 'crudtcc',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

app.get('/usuarios', async (req, res) => {
    try {
      const { name } = req.query;
      let query = `
        SELECT users.*, 
               professores.*, 
               administradores.*
        FROM users
        LEFT JOIN professores ON users.id = professores.user_id
        LEFT JOIN administradores ON users.id = administradores.user_id
      `;
      let params = [];
  
      // Se 'name' for fornecido, faz o filtro pelo nome
      if (name) {
        query += ' WHERE users.name LIKE ?';
        params.push(`%${name}%`);
      }
  
      // Executa a consulta
      const [rows] = await pool.query(query, params);
      res.json(rows);  // Retorna os resultados encontrados
    } catch (error) {
      console.error("Erro ao recuperar usuarios:", error);
      res.status(500).send("Erro ao recuperar usuarios");
    }
  });
  
  
  app.post('/usuarios', async (req, res) => {
    const connection = await pool.getConnection();
    await connection.beginTransaction();
  
    try {
      const { name, email, telefone, disciplina, cargo, isProfessor, isAdministrador } = req.body;
  
      // Insere o usuário na tabela `users`
      const [userResult] = await connection.query(
        'INSERT INTO users (name, email, telefone) VALUES (?, ?, ?)',
        [name, email, telefone]
      );
  
      const userId = userResult.insertId;
  
      // Verifica se o usuário é um professor
      if (isProfessor) {
        await connection.query(
          'INSERT INTO professores (user_id, disciplina) VALUES (?, ?)',
          [userId, disciplina]
        );
      }
  
      // Verifica se o usuário é um administrador
      if (isAdministrador) {
        await connection.query(
          'INSERT INTO administradores (user_id, cargo) VALUES (?, ?)',
          [userId, cargo]
        );
      }
  
      // Confirma a transação
      await connection.commit();
  
      res.json({
        message: "Usuário criado com sucesso",
        usuario: {
          id: userId,
          name,
          email,
          telefone,
        },
        professor: isProfessor ? {
          user_id: userId,
          disciplina,
        } : null, // Retorna null caso o usuário não seja professor
        administracao: isAdministrador ? {
          user_id: userId,
          cargo,
        } : null, // Retorna null caso o usuário não seja administrador
      });
    } catch (error) {
      // Reverte a transação em caso de erro
      await connection.rollback();
      console.error("Erro ao criar usuário, professor e administrador:", error);
      res.status(500).send("Erro ao criar usuário, professor e administrador");
    } finally {
      connection.release();
    }
  });
  
  app.put('/usuarios/:id', async (req, res) => {
    const connection = await pool.getConnection();
    await connection.beginTransaction(); // Inicia a transação
  
    try {
      const { name, email, telefone, isProfessor, disciplina, isAdministrador, cargo } = req.body;
      const { id } = req.params;
  
      // Atualiza os dados do usuário na tabela `users`
      await connection.query(
        'UPDATE users SET name = ?, email = ?, telefone = ? WHERE id = ?',
        [name, email, telefone, id]
      );
  
      // Se for um professor, atualiza os dados na tabela `professores`
      if (isProfessor) {
        await connection.query(
          'INSERT INTO professores (user_id, disciplina) VALUES (?, ?) ON DUPLICATE KEY UPDATE disciplina = ?',
          [id, disciplina, disciplina]
        );
      } else {
        // Se o usuário não for mais professor, remove da tabela `professores`
        await connection.query('DELETE FROM professores WHERE user_id = ?', [id]);
      }
  
      // Se for um administrador, atualiza os dados na tabela `administradores`
      if (isAdministrador) {
        await connection.query(
          'INSERT INTO administradores (user_id, cargo) VALUES (?, ?) ON DUPLICATE KEY UPDATE cargo = ?',
          [id, cargo, cargo]
        );
      } else {
        // Se o usuário não for mais administrador, remove da tabela `administradores`
        await connection.query('DELETE FROM administradores WHERE user_id = ?', [id]);
      }
  
      // Confirma a transação
      await connection.commit();
  
      res.status(200).json({
        message: 'Usuário atualizado com sucesso',
        id,
        name,
        email,
        telefone,
        isProfessor,
        disciplina,
        isAdministrador,
        cargo
      });
    } catch (error) {
      // Em caso de erro, reverte a transação
      await connection.rollback();
      console.error("Erro ao atualizar usuário:", error);
      res.status(500).send("Erro ao atualizar usuário");
    } finally {
      connection.release();
    }
  });
  
  app.delete('/usuarios/:id', async (req, res) => {
    const connection = await pool.getConnection();
    await connection.beginTransaction(); // Inicia a transação
  
    try {
      const { id } = req.params;
  
      // Primeiro, vamos remover o usuário das tabelas associadas
      await connection.query('DELETE FROM professores WHERE user_id = ?', [id]);
      await connection.query('DELETE FROM administradores WHERE user_id = ?', [id]);
  
      // Depois, vamos remover o usuário da tabela `users`
      await connection.query('DELETE FROM users WHERE id = ?', [id]);
  
      // Confirma a transação
      await connection.commit();
  
      res.status(200).json({ id: Number(id), message: 'Usuário e associações deletados com sucesso' });
    } catch (error) {
      // Em caso de erro, reverte a transação
      await connection.rollback();
      console.error("Erro ao deletar usuário:", error);
      res.status(500).send("Erro ao deletar usuário");
    } finally {
      connection.release();
    }
  });
  
  
  app.get('/usuarios/:id', async (req, res) => {
    try {
      const { id } = req.params;
  
      // Realiza a consulta usando JOIN para pegar as informações do usuário e suas tabelas associadas
      const [rows] = await pool.query(`
        SELECT users.*, 
               professores.*, 
               administradores.*
        FROM users
        LEFT JOIN professores ON users.id = professores.user_id
        LEFT JOIN administradores ON users.id = administradores.user_id
        WHERE users.id = ?`, [id]);
  
      // Verifica se o usuário foi encontrado
      if (rows.length === 0) {
        return res.status(404).send("Usuário não encontrado");
      }
  
      res.status(200).json(rows[0]);  // Retorna o primeiro resultado (já que id é único)
    } catch (error) {
      console.error("Erro ao buscar usuarios:", error);
      res.status(500).send("Erro ao buscar usuarios");
    }
  });




  //salas

  app.get('/salas', async (req, res) => {
    try {
      const { bloco } = req.query;
      let query = 'SELECT * FROM salas';
      let params = [];
      
      if (bloco) {
        query += ' WHERE bloco LIKE ?';
        params.push(`%${bloco}%`);
      }
  
      const [rows] = await pool.query(query, params);
      res.json(rows);
    } catch (error) {
      console.error("Erro ao recuperar salas:", error);
      res.status(500).send("Erro ao recuperar salas");
    }
  });
  
  app.post('/salas', async (req, res) => {
    try {
      const { bloco, numero} = req.body;
      const [result] = await pool.query('INSERT INTO salas (bloco, numero) VALUES (?, ?)', [bloco, numero]);
      res.json({ id: result.insertId, bloco:bloco, numero:numero});
    } catch (error) {
      console.error("Erro ao criar salas:", error);
      res.status(500).send("Erro ao criar salas");
    }
  });
  
  app.put('/salas/:id', async (req, res) => {
    try {
      const { bloco, numero} = req.body;
      const { id } = req.params;
      await pool.query('UPDATE salas SET bloco = ?, numero = ? WHERE id = ?', [bloco, numero, id]);
      res.status(200).json({id: id, bloco:bloco, numero:numero});
    } catch (error) {
      console.error("Erro ao atualizar salas:", error);
      res.status(500).send("Erro ao atualizar salas");
    }
  });
  
  app.delete('/salas/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await pool.query('DELETE FROM salas WHERE id = ?', [id]);
      res.status(200).json({ id: Number(id) });
    } catch (error) {
      console.error("Erro ao deletar salas:", error);
      res.status(500).send("Erro ao deletar salas");
    }
  });
  
  app.get('/salas/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const [rows] = await pool.query('SELECT * FROM salas WHERE id = ?', [id]);
      res.status(200).json(rows);
    } catch (error) {
      console.error("Erro ao buscar salas:", error);
      res.status(500).send("Erro ao buscar salas");
    }
  });
  



  //incidentes

  app.get('/incidentes', async (req, res) => {
    try {
      const { titulo } = req.query;
      let query = 'SELECT * FROM incidentes';
      let params = [];
      
      if (titulo) {
        query += ' WHERE titulo LIKE ?';
        params.push(`%${titulo}%`);
      }
  
      const [rows] = await pool.query(query, params);
      res.json(rows);
    } catch (error) {
      console.error("Erro ao recuperar incidentes:", error);
      res.status(500).send("Erro ao recuperar incidentes");
    }
  });
  
  app.post('/incidentes', async (req, res) => {
    try {
      const { users_id, sala_id,titulo,descricao,data_hora,status} = req.body;
      const [result] = await pool.query('INSERT INTO incidentes (users_id, sala_id,titulo,descricao,data_hora,status) VALUES (?, ?,?,?,?,?)', [users_id, sala_id,titulo,descricao,data_hora,status]);
      res.json({ id: result.insertId, users_id:users_id, sala_id:sala_id, titulo:titulo, descricao:descricao, data_hora:data_hora, status:status});
    } catch (error) {
      console.error("Erro ao criar incidentes:", error);
      res.status(500).send("Erro ao criar incidentes");
    }
  });
  
  app.put('/incidentes/:id', async (req, res) => {
    try {
      const { users_id, sala_id,titulo,descricao,data_hora,status} = req.body;
      const { id } = req.params;
      await pool.query('UPDATE incidentes SET users_id = ?, sala_id = ? , titulo = ?, descricao = ?, data_hora = ? , status = ? WHERE id = ?', [users_id, sala_id,titulo,descricao,data_hora,status, id]);
      res.status(200).json({id: id, users_id:users_id, sala_id:sala_id, titulo:titulo, descricao:descricao, data_hora:data_hora, status:status});
    } catch (error) {
      console.error("Erro ao atualizar incidentes:", error);
      res.status(500).send("Erro ao atualizar incidentes");
    }
  });
  
  app.delete('/incidentes/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await pool.query('DELETE FROM incidentes WHERE id = ?', [id]);
      res.status(200).json({ id: Number(id) });
    } catch (error) {
      console.error("Erro ao deletar incidentes:", error);
      res.status(500).send("Erro ao deletar incidentes");
    }
  });
  
  app.get('/incidentes/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const [rows] = await pool.query('SELECT * FROM incidentes WHERE id = ?', [id]);
      res.status(200).json(rows);
    } catch (error) {
      console.error("Erro ao buscar incidentes:", error);
      res.status(500).send("Erro ao buscar incidentes");
    }
  });



  //dispositivos

  app.get('/dispositivos', async (req, res) => {
    try {
      const { name } = req.query;
      let query = 'SELECT * FROM dispositivos';
      let params = [];
      
      if (name) {
        query += ' WHERE name LIKE ?';
        params.push(`%${name}%`);
      }
  
      const [rows] = await pool.query(query, params);
      res.json(rows);
    } catch (error) {
      console.error("Erro ao recuperar dispositivos:", error);
      res.status(500).send("Erro ao recuperar dispositivos");
    }
  });
  
  app.post('/dispositivos', async (req, res) => {
    try {
      const {sala_id, name, localizacao, descricao} = req.body;
      const [result] = await pool.query('INSERT INTO dispositivos (sala_id, name, localizacao, descricao) VALUES (?, ?, ?, ?)', [sala_id, name, localizacao, descricao]);
      res.json({ id: result.insertId, sala_id:sala_id, name:name, localizacao:localizacao, descricao:descricao});
    } catch (error) {
      console.error("Erro ao criar dispositivos:", error);
      res.status(500).send("Erro ao criar dispositivos");
    }
  });
  
  app.put('/dispositivos/:id', async (req, res) => {
    try {
      const { sala_id, name, localizacao, descricao} = req.body;
      const { id } = req.params;
      await pool.query('UPDATE dispositivos SET sala_id = ?, name = ?, localizacao = ?, descricao = ? WHERE id = ?', [sala_id, name, localizacao, descricao, id]);
      res.status(200).json({id: id,  sala_id:sala_id, name:name, localizacao:localizacao, descricao:descricao});
    } catch (error) {
      console.error("Erro ao atualizar dispositivos:", error);
      res.status(500).send("Erro ao atualizar dispositivos");
    }
  });
  
  app.delete('/dispositivos/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await pool.query('DELETE FROM dispositivos WHERE id = ?', [id]);
      res.status(200).json({ id: Number(id) });
    } catch (error) {
      console.error("Erro ao deletar dispositivos:", error);
      res.status(500).send("Erro ao deletar dispositivos");
    }
  });
  
  app.get('/dispositivos/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const [rows] = await pool.query('SELECT * FROM dispositivos WHERE id = ?', [id]);
      res.status(200).json(rows);
    } catch (error) {
      console.error("Erro ao buscar dispositivos:", error);
      res.status(500).send("Erro ao buscar dispositivos");
    }
  });




  //incidentes_dispositivos

  app.get('/incidentes_dispositivos', async (req, res) => {
    try {
      const { name } = req.query;
      let query = 'SELECT * FROM incidentes_dispositivos';
      let params = [];
      
      if (name) {
        query += ' WHERE name LIKE ?';
        params.push(`%${name}%`);
      }
  
      const [rows] = await pool.query(query, params);
      res.json(rows);
    } catch (error) {
      console.error("Erro ao recuperar incidentes com dispositivos:", error);
      res.status(500).send("Erro ao recuperar incidentes com dispositivos");
    }
  });
  
  app.post('/incidentes_dispositivos', async (req, res) => {
    try {
      const {incidentes_id,	dispositivos_id, descricao} = req.body;
      const [result] = await pool.query('INSERT INTO incidentes_dispositivos (incidentes_id,	dispositivos_id,	descricao) VALUES (?, ?, ?)', [incidentes_id,	dispositivos_id,	descricao]);
      res.json({ id: result.insertId, incidentes_id:incidentes_id, dispositivos_id:dispositivos_id, descricao:descricao});
    } catch (error) {
      console.error("Erro ao criar incidentes com dispositivos:", error);
      res.status(500).send("Erro ao criar incidentes com dispositivos");
    }
  });
  
  app.put('/incidentes_dispositivos/:id', async (req, res) => {
    try {
      const { incidentes_id,	dispositivos_id, descricao} = req.body;
      const { id } = req.params;
      await pool.query('UPDATE incidentes_dispositivos SET incidentes_id = ?,	dispositivos_id = ?, descricao = ? WHERE id = ?', [incidentes_id,	dispositivos_id, descricao, id]);
      res.status(200).json({id: id, incidentes_id:incidentes_id,	dispositivos_id:dispositivos_id,	descricao:descricao});
    } catch (error) {
      console.error("Erro ao atualizar incidentes com dispositivos:", error);
      res.status(500).send("Erro ao atualizar incidentes com dispositivos");
    }
  });
  
  app.delete('/incidentes_dispositivos/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await pool.query('DELETE FROM incidentes_dispositivos WHERE id = ?', [id]);
      res.status(200).json({ id: Number(id) });
    } catch (error) {
      console.error("Erro ao deletar incidentes com dispositivos:", error);
      res.status(500).send("Erro ao deletar incidentes com dispositivos");
    }
  });
  
  app.get('/incidentes_dispositivos/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const [rows] = await pool.query('SELECT * FROM incidentes_dispositivos WHERE id = ?', [id]);
      res.status(200).json(rows);
    } catch (error) {
      console.error("Erro ao buscar incidentes com dispositivos:", error);
      res.status(500).send("Erro ao buscar incidentes com dispositivos");
    }
  });

  const server = app.listen(3000, () => {
    console.log('Servidor rodando na porta 3000');
  });
  
  // Mantém o servidor rodando mesmo se ocorrer um erro
  process.on('uncaughtException', (err) => {
    console.error('Erro não tratado:', err);
  });
  
  process.on('unhandledRejection', (err) => {
    console.error('Rejeição não tratada:', err);
  });
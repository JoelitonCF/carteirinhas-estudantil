import mysql.connector
import os
from dotenv import load_dotenv

load_dotenv()  # carrega variáveis do arquivo .env

def get_connection():
    return mysql.connector.connect(
        host     = os.getenv('DB_HOST', 'localhost'),
        port     = int(os.getenv('DB_PORT', 3306)),
        database = os.getenv('DB_NAME', 'carteirinhas'),
        user     = os.getenv('DB_USER', 'carteirinhas_user'),
        password = os.getenv('DB_PASSWORD', 'SenhaForte@2025'),
        charset  = 'utf8mb4'
    )

def listar_alunos(turma=None, turno=None):
    conn   = get_connection()
    cursor = conn.cursor(dictionary=True)
    sql    = 'SELECT * FROM alunos WHERE 1=1'
    params = []
    if turma:
        sql += ' AND turma = %s'
        params.append(turma)
    if turno:
        sql += ' AND turno = %s'
        params.append(turno)
    
    # Ordernar por nome apra facilitar a exibição
    sql += ' ORDER BY nome ASC'
    
    cursor.execute(sql, params)
    resultado = cursor.fetchall()
    cursor.close()
    conn.close()
    return resultado

def obter_aluno(aluno_id):
    conn   = get_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute('SELECT * FROM alunos WHERE id = %s', (aluno_id,))
    resultado = cursor.fetchone()
    cursor.close()
    conn.close()
    return resultado

def inserir_aluno(nome, matricula, turma, turno, foto, ano_letivo):
    conn   = get_connection()
    cursor = conn.cursor()
    sql = '''INSERT INTO alunos
             (nome, matricula, turma, turno, foto, ano_letivo)
             VALUES (%s, %s, %s, %s, %s, %s)'''
    cursor.execute(sql, (nome, matricula, turma, turno, foto, ano_letivo))
    conn.commit()
    novo_id = cursor.lastrowid
    cursor.close()
    conn.close()
    return novo_id

def atualizar_aluno(aluno_id, nome, matricula, turma, turno, foto=None):
    conn   = get_connection()
    cursor = conn.cursor()
    
    if foto:
        sql = '''UPDATE alunos 
                 SET nome=%s, matricula=%s, turma=%s, turno=%s, foto=%s 
                 WHERE id=%s'''
        cursor.execute(sql, (nome, matricula, turma, turno, foto, aluno_id))
    else:
        sql = '''UPDATE alunos 
                 SET nome=%s, matricula=%s, turma=%s, turno=%s 
                 WHERE id=%s'''
        cursor.execute(sql, (nome, matricula, turma, turno, aluno_id))
        
    conn.commit()
    linhas_afetadas = cursor.rowcount
    cursor.close()
    conn.close()
    return linhas_afetadas > 0

def excluir_aluno(aluno_id):
    conn   = get_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM alunos WHERE id = %s', (aluno_id,))
    conn.commit()
    linhas_afetadas = cursor.rowcount
    cursor.close()
    conn.close()
    return linhas_afetadas > 0

def marcar_impresso(aluno_id, impresso):
    conn   = get_connection()
    cursor = conn.cursor()
    cursor.execute('UPDATE alunos SET impresso = %s WHERE id = %s', (int(impresso), aluno_id))
    conn.commit()
    linhas_afetadas = cursor.rowcount
    cursor.close()
    conn.close()
    return linhas_afetadas > 0

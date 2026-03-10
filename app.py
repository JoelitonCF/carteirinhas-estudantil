import os
from flask import Flask, render_template, request, jsonify, redirect, url_for, send_from_directory
from werkzeug.utils import secure_filename
import database

app = Flask(__name__)
# A secret key é necessária para sessões (mesmo que não usemos explicitamente)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "dev-secret-key")

# Configurações de Upload
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__name__)), 'uploads')
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg'}

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Garantir que a pasta de uploads existe
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


# ROTAS DE PÁGINAS (FRONTEND)


@app.route('/')
def index():
    return redirect(url_for('page_cadastro'))

@app.route('/cadastro')
def page_cadastro():
    return render_template('cadastro.html')

@app.route('/listagem')
def page_listagem():
    return render_template('listagem.html')

@app.route('/gerador')
def page_gerador():
    return render_template('gerador.html')

#ROTAS API / BACKEND

@app.route('/api/turmas', methods=['GET'])
def get_turmas():
    try:
        turmas = database.listar_turmas()
        return jsonify(turmas)
    except Exception as e:
        return jsonify({"erro": str(e)}), 500

@app.route('/api/alunos', methods=['GET'])
def get_alunos():
    turma = request.args.get('turma')
    turno = request.args.get('turno')
    try:
        alunos = database.listar_alunos(turma, turno)
        return jsonify(alunos)
    except Exception as e:
        return jsonify({"erro": str(e)}), 500

@app.route('/api/alunos/<int:aluno_id>', methods=['GET'])
def get_aluno(aluno_id):
    try:
        aluno = database.obter_aluno(aluno_id)
        if aluno:
            return jsonify(aluno)
        return jsonify({"erro": "Aluno não encontrado"}), 404
    except Exception as e:
        return jsonify({"erro": str(e)}), 500

@app.route('/api/alunos', methods=['POST'])
def criar_aluno():
    if 'foto' not in request.files:
        return jsonify({"erro": "Nenhuma imagem foi enviada."}), 400
        
    foto_file = request.files['foto']
    
    if foto_file.filename == '':
        return jsonify({"erro": "Nenhuma imagem selecionada."}), 400
        
    if not (foto_file and allowed_file(foto_file.filename)):
        return jsonify({"erro": "Formato de arquivo não suportado. Use JPG ou PNG."}), 400

    # Lendo os os outros campos do form
    nome = request.form.get('nome')
    codigo_inep = request.form.get('codigo_inep')
    nome_mae = request.form.get('nome_mae')
    data_nascimento = request.form.get('data_nascimento')
    curso = request.form.get('curso')
    turma = request.form.get('turma')
    turno = request.form.get('turno')
    ano_letivo = request.form.get('ano_letivo', '2026')
    
    if not all([nome, codigo_inep, nome_mae, data_nascimento, curso, turma, turno]):
        return jsonify({"erro": "Todos os campos de texto são obrigatórios."}), 400

    # Salva o arquivo com o codigo INEP para evitar nomes duplicados
    extensao = foto_file.filename.rsplit('.', 1)[1].lower()
    nome_arquivo = secure_filename(f"{codigo_inep}.{extensao}")
    caminho_salvar = os.path.join(app.config['UPLOAD_FOLDER'], nome_arquivo)
    
    try:
        foto_file.save(caminho_salvar)
        
        # Salva no banco apontando para o arquivo no BD
        novo_id = database.inserir_aluno(
            nome=nome,
            codigo_inep=codigo_inep,
            nome_mae=nome_mae,
            data_nascimento=data_nascimento,
            curso=curso,
            turma=turma,
            turno=turno,
            foto=nome_arquivo,
            ano_letivo=ano_letivo
        )
        return jsonify({"sucesso": True, "id": novo_id, "mensagem": "Aluno cadastrado com sucesso!"}), 201
    except mysql.connector.errors.IntegrityError as e:
        # Pega a exceção se a matricula já estiver cadastrada (UNIQUE)
        return jsonify({"erro": f"Matrícula {matricula} já está cadastrada no sistema."}), 400
    except Exception as e:
        return jsonify({"erro": str(e)}), 500

@app.route('/api/alunos/<int:aluno_id>', methods=['PUT', 'POST']) # Aceitando POST como fallback caso haja erro com XMLHttpRequest
def atualizar_aluno(aluno_id):
    # Validando se o aluno existe
    if not database.obter_aluno(aluno_id):
        return jsonify({"erro": "Aluno não encontrado"}), 404
        
    nome = request.form.get('nome')
    codigo_inep = request.form.get('codigo_inep')
    nome_mae = request.form.get('nome_mae')
    data_nascimento = request.form.get('data_nascimento')
    curso = request.form.get('curso', 'ENSINO MEDIO')
    turma = request.form.get('turma')
    turno = request.form.get('turno')
    
    if not all([nome, codigo_inep, nome_mae, data_nascimento, curso, turma, turno]):
        return jsonify({"erro": "Todos os campos de texto são obrigatórios."}), 400

    nome_arquivo = None
    
    # Tratamento de envio de nova foto
    if 'foto' in request.files:
        foto_file = request.files['foto']
        if foto_file.filename != '' and allowed_file(foto_file.filename):
            extensao = foto_file.filename.rsplit('.', 1)[1].lower()
            nome_arquivo = secure_filename(f"{codigo_inep}.{extensao}")
            caminho_salvar = os.path.join(app.config['UPLOAD_FOLDER'], nome_arquivo)
            foto_file.save(caminho_salvar)

    try:
        atualizado = database.atualizar_aluno(aluno_id, nome, codigo_inep, nome_mae, data_nascimento, curso, turma, turno, nome_arquivo)
        return jsonify({"sucesso": True, "mensagem": "Aluno atualizado com sucesso!"}), 200
    except Exception as e:
        return jsonify({"erro": str(e)}), 500

@app.route('/api/alunos/<int:aluno_id>', methods=['DELETE'])
def excluir_aluno(aluno_id):
    try:
        aluno = database.obter_aluno(aluno_id)
        if not aluno:
            return jsonify({"erro": "Aluno não encontrado"}), 404
            
        # Opcional: remover a foto da pasta de uploads
        if aluno.get('foto'):
            caminho_foto = os.path.join(app.config['UPLOAD_FOLDER'], aluno['foto'])
            if os.path.exists(caminho_foto):
                os.remove(caminho_foto)
                
        database.excluir_aluno(aluno_id)
        return jsonify({"sucesso": True, "mensagem": "Aluno removido com sucesso!"}), 200
    except Exception as e:
        return jsonify({"erro": str(e)}), 500

@app.route('/api/alunos/<int:aluno_id>/impresso', methods=['PATCH', 'POST']) # Aceitando POST como fallback
def marcar_impresso(aluno_id):
    dados = request.get_json(silent=True) or {}
    
    # Se receber request form ou params url pegue também
    if not dados and request.form.get('impresso') is not None:
        impresso = request.form.get('impresso') == 'true' or request.form.get('impresso') == '1'
    elif not dados and request.args.get('impresso') is not None:
         impresso = request.args.get('impresso') == 'true' or request.args.get('impresso') == '1'
    else:
        impresso = dados.get('impresso', True)
        
    try:
        atualizado = database.marcar_impresso(aluno_id, impresso)
        if atualizado:
            return jsonify({"sucesso": True}), 200
        return jsonify({"erro": "Aluno não encontrado ou sem alteração."}), 404
    except Exception as e:
        return jsonify({"erro": str(e)}), 500

@app.route('/api/turmas', methods=['POST'])
def criar_turma():
    dados = request.get_json(silent=True) or {}
    
    if not dados and request.form:
        dados = request.form.to_dict()
        
    nome = dados.get('nome')
    sigla = dados.get('sigla')
    
    if not nome or not sigla:
        return jsonify({"erro": "Nome e Sigla da turma são obrigatórios."}), 400
        
    try:
        novo_id = database.inserir_turma(nome, sigla)
        return jsonify({"sucesso": True, "id": novo_id, "mensagem": "Turma criada com sucesso!"}), 201
    except mysql.connector.errors.IntegrityError:
        return jsonify({"erro": f"Turma com a sigla '{sigla}' já existe."}), 400
    except Exception as e:
        return jsonify({"erro": str(e)}), 500

@app.route('/uploads/<path:filename>')
def custom_static_fotos(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

if __name__ == '__main__':
    # Roda em 0.0.0.0 para aceitar conexões da rede local 
    # e na porta 5000 conforme especificado na versão 2.0
    app.run(host='0.0.0.0', port=5000, debug=True)

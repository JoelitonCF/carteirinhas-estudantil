document.addEventListener('DOMContentLoaded', () => {

    const tabelaAlunos = document.getElementById('tabela-alunos');
    const btnFiltrar = document.getElementById('btn-filtrar');
    const filtroTurma = document.getElementById('filtro-turma');
    const filtroTurno = document.getElementById('filtro-turno');

    // Carregar alunos ao abrir a página
    carregarAlunos();

    btnFiltrar.addEventListener('click', carregarAlunos);

    async function carregarAlunos() {
        try {
            const turma = filtroTurma.value;
            const turno = filtroTurno.value;

            let url = '/api/alunos';
            const params = new URLSearchParams();
            if (turma) params.append('turma', turma);
            if (turno) params.append('turno', turno);

            if (params.toString()) {
                url += '?' + params.toString();
            }

            const res = await fetch(url);
            const dados = await res.json();

            if (res.ok) {
                renderizarTabela(dados);
            } else {
                showAlert('danger', dados.erro || 'Erro ao carregar dados');
            }
        } catch (e) {
            console.error(e);
            showAlert('danger', 'Erro de conexão com o servidor');
        }
    }

    function renderizarTabela(alunos) {
        if (alunos.length === 0) {
            tabelaAlunos.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 30px; color: var(--text-secondary);">Nenhum aluno encontrado.</td></tr>`;
            return;
        }

        tabelaAlunos.innerHTML = alunos.map(aluno => `
            <tr>
                <td>
                    <img src="/uploads/${aluno.foto}" alt="Foto" class="table-foto" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(aluno.nome)}&background=random'">
                </td>
                <td><strong>${aluno.matricula}</strong></td>
                <td>${aluno.nome}</td>
                <td>${aluno.turma}</td>
                <td>${aluno.turno}</td>
                <td>
                    <span class="status-badge ${aluno.impresso ? 'status-impresso' : 'status-pendente'}">
                        ${aluno.impresso ? '<i class="fa-solid fa-check"></i> Impresso' : '<i class="fa-solid fa-clock"></i> Pendente'}
                    </span>
                </td>
                <td class="actions-cell">
                    <button class="btn btn-outline btn-sm" onclick="toggleImpresso(${aluno.id}, ${aluno.impresso})" title="Marcar/Desmarcar Impressão">
                        <i class="fa-solid fa-print"></i>
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="deletarAluno(${aluno.id})" title="Excluir Registro">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    // Funcionalidades Globais Injetadas para os botões do HTML via onclick
    window.deletarAluno = async (id) => {
        if (confirm('Tem certeza que deseja excluir permanentemente este aluno?')) {
            try {
                const res = await fetch(`/api/alunos/${id}`, { method: 'DELETE' });
                const dados = await res.json();

                if (res.ok) {
                    showAlert('success', 'Aluno excluído com sucesso!');
                    carregarAlunos(); // Atualiza listagem
                } else {
                    showAlert('danger', dados.erro);
                }
            } catch (e) {
                showAlert('danger', 'Erro de conexão');
            }
        }
    };

    window.toggleImpresso = async (id, statusAtual) => {
        const novoStatus = !(statusAtual == 1 || statusAtual == true); // Inverte
        const requestStatus = novoStatus ? 1 : 0;

        try {
            const formData = new FormData();
            formData.append('impresso', requestStatus);

            const res = await fetch(`/api/alunos/${id}/impresso`, {
                method: 'POST', // Usando POST como fallback (compatibilidade da Rota)
                body: formData
            });

            if (res.ok) {
                carregarAlunos(); // Atualiza listagem pra refletir nova badge
            } else {
                showAlert('danger', 'Erro ao atualizar status');
            }
        } catch (e) {
            showAlert('danger', 'Erro de conexão');
        }
    };
});

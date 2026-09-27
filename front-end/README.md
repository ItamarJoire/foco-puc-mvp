# Foco | front-end do MVP

Interface web do **Foco**, um organizador de tarefas que coloca o prazo no centro: o que venceu e continua pendente aparece destacado, para decidir rápido o que atacar primeiro.

É uma **SPA (Single Page Application)** escrita em **HTML, CSS e JavaScript puros**. Sem React, Vue, Angular ou qualquer framework de SPA, e sem framework de estilo. Toda a navegação acontece em uma única página, trocando as telas por JavaScript.

O back-end fica em repositório separado: **[back-end](https://github.com/ItamarJoire/foco-puc-mvp/tree/master/back-end)**.

## Funcionalidades

- Cadastro e login de usuário, com token JWT guardado no navegador.
- Quadro de tarefas em **cards**, com título, descrição, prazo e situação.
- Criação, edição completa, conclusão e exclusão de tarefas.
- Filtros por situação (todas, pendentes, concluídas) resolvidos pela própria API.
- Resumo com total, pendentes, concluídas e atrasadas.
- Destaque automático de tarefas com prazo vencido.
- Indicador de API online/offline no cabeçalho.
- **Painel "Chamadas à API"**: mostra ao vivo cada requisição disparada pela tela, com método, rota e código de status.
- Tema claro e escuro, com a preferência lembrada.
- Layout responsivo, do desktop ao celular.

## Pré-requisitos

- Um navegador atualizado (Chrome, Edge ou Firefox).
- A API do projeto rodando em `http://127.0.0.1:5000` — veja o README do repositório `back-end`.

Não é necessário instalar nada, nem servidor local, nem extensão do navegador.

## Instalação e execução

```bash
git clone <url-deste-repositorio>
cd front-end
```

1. Suba a API (no outro repositório):

   ```bash
   cd ../back-end
   .\.venv\Scripts\Activate.ps1   # Windows
   python app.py
   ```

2. Abra o arquivo **`index.html`** com dois cliques, ou arraste-o para o navegador.

3. Crie uma conta na aba **Criar conta** e comece a usar.

O indicador no canto superior direito mostra **API online** quando a comunicação está funcionando.

### Apontando para outro endereço

O endereço da API fica em um único lugar, `js/config.js`:

```js
var CONFIG = {
  API_BASE_URL: "http://127.0.0.1:5000",
  ...
};
```

## Estrutura do projeto

```
front-end/
├── index.html          # estrutura da página e das telas
├── css/
│   └── style.css       # estilos próprios: tokens de cor, temas, layout e componentes
└── js/
    ├── config.js       # endereço da API e chaves de armazenamento
    ├── api.js          # cliente HTTP: uma função por rota + registro das chamadas
    ├── auth.js         # sessão do usuário e tema
    ├── ui.js           # renderização de cards, resumo, modal, avisos e painel
    └── app.js          # eventos da tela e orquestração das chamadas
```

Os scripts são carregados como scripts clássicos (sem `type="module"`), justamente para que o `index.html` funcione ao ser aberto direto do disco.

## Quais rotas cada ação chama

| Ação na tela                       | Requisição                                       |
| ---------------------------------- | ------------------------------------------------ |
| Abrir a página                     | `GET /ping`                                      |
| Criar conta                        | `POST /auth/register` + `POST /auth/login`       |
| Entrar                             | `POST /auth/login`                               |
| Carregar o quadro / filtro "Todas" | `GET /tasks`                                     |
| Filtro "Pendentes" / "Concluídas"  | `GET /tasks?done=false` / `GET /tasks?done=true` |
| Adicionar tarefa                   | `POST /tasks`                                    |
| Botão "Detalhes" no card           | `GET /tasks/<id>`                                |
| Salvar alterações no modal         | `PUT /tasks/<id>`                                |
| Caixa de seleção do card           | `PATCH /tasks/<id>`                              |
| Botão "Excluir"                    | `DELETE /tasks/<id>`                             |

Todas as chamadas aparecem no painel lateral **Chamadas à API** enquanto você usa o sistema.

## Decisões de implementação

- **Sem framework de SPA**: a troca de telas usa o atributo `hidden` e uma função de renderização própria.
- **Camadas separadas**: a tela (`ui.js`) não conhece HTTP, e o cliente da API (`api.js`) não conhece o DOM. O `app.js` é quem liga os dois.
- **Um ponto único de requisição**: `Api.request()` centraliza headers, token, tratamento de erro e registro da chamada.
- **Token em `localStorage` com proteção**: se o navegador bloquear o armazenamento, a sessão continua valendo em memória até fechar a aba.
- **Erros tratados**: falha de rede, validação (400), credenciais (401) e recurso inexistente (404) viram avisos legíveis na tela; um 401 devolve o usuário para a tela de login.

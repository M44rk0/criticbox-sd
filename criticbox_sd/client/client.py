import argparse
import os
import sys

import grpc

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(os.path.join(BASE_DIR, "generated"))

import criticbox_pb2 as pb2
import criticbox_pb2_grpc as pb2_grpc

DEFAULT_HOST = os.getenv("GRPC_SERVER_HOST", "localhost")
DEFAULT_PORT = os.getenv("GRPC_SERVER_PORT", "50051")


class CriticboxClient:
    def __init__(self, host=DEFAULT_HOST, port=DEFAULT_PORT):
        self.server_address = f"{host}:{port}"
        print(f"[*] Conectando ao servidor gRPC em {self.server_address}...")
        self.channel = grpc.insecure_channel(self.server_address)
        self.stub = pb2_grpc.CriticboxServiceStub(self.channel)

    def _call(self, rpc_func, request):
        try:
            return rpc_func(request)
        except grpc.RpcError as e:
            print(f"[-] Erro gRPC: {e.code()} - {e.details()}")
            return None

    def search_movies(self, query: str, page: int = 1):
        print(f"\n[SearchMovies] Buscando: '{query}'...")
        res = self._call(self.stub.SearchMovies, pb2.SearchMoviesRequest(query=query, page=page))
        if not res:
            return
        print(f"\n[+] Total encontrado: {res.total_results} (Pagina {res.page})")
        print("-" * 75)
        for m in res.movies:
            rating = (
                f"{m.criticbox_rating:.1f}/5.0 ({m.criticbox_review_count} avaliacoes)"
                if m.criticbox_review_count
                else "Sem notas ainda"
            )
            year = m.release_date[:4] if m.release_date else "N/A"
            print(f"[{m.tmdb_id}] {m.title} ({year})")
            print(f"   * TMDb: {m.tmdb_vote_average:.1f}/10 | Criticbox: {rating}")
            print(f"   * Poster: {m.poster_url or 'N/A'}")
            print(f"   * Sinopse: {m.overview[:120]}..." if len(m.overview) > 120 else f"   * Sinopse: {m.overview}")
            print("-" * 75)

    def create_review(
        self,
        tmdb_id: int,
        user_id: str,
        rating: float,
        comment: str = "",
        contains_spoilers: bool = False,
    ):
        print(f"\n[CreateReview] Enviando avaliacao de @{user_id} para filme ID {tmdb_id}...")
        res = self._call(
            self.stub.CreateReview,
            pb2.CreateReviewRequest(
                tmdb_id=tmdb_id,
                user_id=user_id,
                rating=rating,
                comment=comment,
                contains_spoilers=contains_spoilers,
            ),
        )
        if not res:
            return
        if res.success:
            print(f"[+] [Sucesso] Review registrada! ID: {res.review_id} | @{res.user_id} ({res.rating:.1f} estrelas)")
        else:
            print(f"[-] Falha na validacao: {res.message}")

    def list_all_reviews(self):
        print("\n[GetAllReviews] Listando todas as reviews cadastradas no Criticbox...")
        res = self._call(self.stub.GetAllReviews, pb2.GetAllReviewsRequest())
        if not res:
            return
        if not res.reviews:
            print("\nNenhuma review registrada no sistema ainda.")
            return

        print(f"\n[+] Total de reviews encontradas: {res.total_count}")
        print("=" * 75)
        for r in res.reviews:
            spoiler = " [ALERTA DE SPOILER]" if r.contains_spoilers else ""
            print(f"🎬 Filme: {r.movie_title} (ID TMDb: {r.tmdb_id})")
            print(f"👤 Usuario: @{r.user_id} | Nota: {r.rating:.1f}/5.0 | Data: {r.created_at}{spoiler}")
            if r.comment:
                print(f'💬 Review: "{r.comment}"')
            else:
                print("💬 Review: (Sem comentario)")
            print("-" * 75)


def interactive_menu(client: CriticboxClient):
    menu = (
        "\n==================================================\n"
        "[*] [Microsservico A] Criticbox gRPC Client\n"
        "==================================================\n"
        "1. Buscar Filmes\n"
        "2. Escrever Review\n"
        "3. Listar Reviews de Todos os Usuarios\n"
        "0. Sair\n"
        "=================================================="
    )
    while True:
        print(menu)
        choice = input("Opcao: ").strip()
        if choice == "1":
            client.search_movies(input("Titulo: ").strip())
        elif choice == "2":
            val = input("ID TMDb: ").strip()
            if not val.isdigit():
                continue
            user = input("Usuario: ").strip()
            try:
                rating = float(input("Nota (0.5 a 5.0): ").strip())
            except ValueError:
                continue
            comment = input("Comentario: ").strip()
            spoiler = input("Spoiler? (s/N): ").strip().lower() in ("s", "sim")
            client.create_review(int(val), user, rating, comment, spoiler)
        elif choice == "3":
            client.list_all_reviews()
        elif choice == "0":
            break


def main():
    parser = argparse.ArgumentParser(description="Cliente gRPC do Criticbox")
    parser.add_argument("--host", default=DEFAULT_HOST)
    parser.add_argument("--port", default=DEFAULT_PORT)
    parser.add_argument("--search", type=str)
    parser.add_argument("--all-reviews", action="store_true", help="Listar reviews de todos os usuarios")
    args = parser.parse_args()

    client = CriticboxClient(host=args.host, port=args.port)
    if args.search:
        client.search_movies(args.search)
    elif args.all_reviews:
        client.list_all_reviews()
    else:
        interactive_menu(client)


if __name__ == "__main__":
    main()

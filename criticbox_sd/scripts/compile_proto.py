import glob
import os
import sys

from grpc_tools import protoc


def compile_proto():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    proto_dir = os.path.join(base_dir, "proto")
    output_dir = os.path.join(base_dir, "generated")

    os.makedirs(output_dir, exist_ok=True)
    init_file = os.path.join(output_dir, "__init__.py")
    if not os.path.exists(init_file):
        with open(init_file, "w") as f:
            f.write("")

    proto_files = glob.glob(os.path.join(proto_dir, "*.proto"))
    if not proto_files:
        print("[-] Nenhum arquivo .proto encontrado em", proto_dir)
        sys.exit(1)

    for proto_file in proto_files:
        proto_name = os.path.basename(proto_file)
        cmd = [
            "grpc_tools.protoc",
            f"-I{proto_dir}",
            f"--python_out={output_dir}",
            f"--grpc_python_out={output_dir}",
            proto_file,
        ]
        print(f"[*] Compilando {proto_name}...")
        if protoc.main(cmd) != 0:
            print(f"[-] Erro ao compilar {proto_name}")
            sys.exit(1)

        base_name = os.path.splitext(proto_name)[0]
        grpc_file = os.path.join(output_dir, f"{base_name}_pb2_grpc.py")
        if os.path.exists(grpc_file):
            with open(grpc_file, "r", encoding="utf-8") as f:
                content = f.read()
            target = f"import {base_name}_pb2 as {base_name}__pb2"
            if target in content and "from . import" not in content:
                content = content.replace(
                    target,
                    f"try:\n    from . import {base_name}_pb2 as {base_name}__pb2\nexcept ImportError:\n    {target}",
                )
                with open(grpc_file, "w", encoding="utf-8") as f:
                    f.write(content)

    print("[OK] Todos os Protocol Buffers foram compilados com sucesso.")


if __name__ == "__main__":
    compile_proto()

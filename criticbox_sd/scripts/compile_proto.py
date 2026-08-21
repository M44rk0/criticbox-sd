import os
import sys

from grpc_tools import protoc


def compile_proto():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    proto_dir = os.path.join(base_dir, "proto")
    output_dir = os.path.join(base_dir, "generated")
    proto_file = os.path.join(proto_dir, "criticbox.proto")

    os.makedirs(output_dir, exist_ok=True)
    init_file = os.path.join(output_dir, "__init__.py")
    if not os.path.exists(init_file):
        with open(init_file, "w") as f:
            f.write("")

    cmd = [
        "grpc_tools.protoc",
        f"-I{proto_dir}",
        f"--python_out={output_dir}",
        f"--grpc_python_out={output_dir}",
        proto_file,
    ]
    if protoc.main(cmd) != 0:
        sys.exit(1)

    grpc_file = os.path.join(output_dir, "criticbox_pb2_grpc.py")
    if os.path.exists(grpc_file):
        with open(grpc_file, "r", encoding="utf-8") as f:
            content = f.read()
        target = "import criticbox_pb2 as criticbox__pb2"
        if target in content and "from . import" not in content:
            content = content.replace(
                target,
                f"try:\n    from . import criticbox_pb2 as criticbox__pb2\nexcept ImportError:\n    {target}",
            )
            with open(grpc_file, "w", encoding="utf-8") as f:
                f.write(content)
    print("[OK] Protocol Buffers compilados com sucesso.")


if __name__ == "__main__":
    compile_proto()

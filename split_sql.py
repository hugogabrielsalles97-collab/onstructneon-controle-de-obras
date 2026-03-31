import os

with open(r'c:\Users\hugo.sales\OneDrive - EGTC INFRA S.A\Documentos\REPOSITÓRIO\onstructneon-controle-de-obras\restore_data.sql', 'r', encoding='utf-8') as f:
    lines = f.readlines()

chunks = []
current_chunk = []
for line in lines:
    current_chunk.append(line)
    if line.strip().endswith(');'):
        chunks.append("".join(current_chunk))
        current_chunk = []

if current_chunk:
    chunks.append("".join(current_chunk))

# The first chunk should include the DELETE statement
# or we can just prepend it to the first chunk.

for i, chunk in enumerate(chunks):
    file_path = fr'c:\Users\hugo.sales\OneDrive - EGTC INFRA S.A\Documentos\REPOSITÓRIO\onstructneon-controle-de-obras\restore_chunk_{i+1}.sql'
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(chunk)
    print(f"Created {file_path}")

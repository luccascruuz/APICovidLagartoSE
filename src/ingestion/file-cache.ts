import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { FonteAno } from '../modules/srag/srag.repository'
import type { CasoSrag } from '../modules/srag/srag.types'

const VERSAO = 1

export interface ConteudoCache {
  versao: number
  municipioIbge: string
  fonte: FonteAno
  casos: CasoSrag[]
}

export class FileCache {
  constructor(private readonly diretorio: string) {}

  private caminho(ano: number) {
    return path.join(this.diretorio, `srag-${ano}.json`)
  }

  async ler(ano: number, municipioIbge: string): Promise<ConteudoCache | null> {
    let bruto: string
    try {
      bruto = await readFile(this.caminho(ano), 'utf8')
    } catch (erro) {
      if ((erro as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw erro
    }
    const conteudo = JSON.parse(bruto) as ConteudoCache
    if (conteudo.versao !== VERSAO || conteudo.municipioIbge !== municipioIbge) return null
    return conteudo
  }

  async salvar(municipioIbge: string, fonte: FonteAno, casos: CasoSrag[]): Promise<void> {
    await mkdir(this.diretorio, { recursive: true })
    const destino = this.caminho(fonte.ano)
    const temporario = `${destino}.${process.pid}.tmp`
    const conteudo: ConteudoCache = { versao: VERSAO, municipioIbge, fonte, casos }
    await writeFile(temporario, JSON.stringify(conteudo))
    await rename(temporario, destino)
  }
}

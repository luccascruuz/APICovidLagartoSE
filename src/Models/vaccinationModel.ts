import mongoose, { Schema } from 'mongoose'

const Vaccination = new Schema(
    {
        document_id: String,
        paciente_id: String,
        paciente_idade: Number,
        paciente_dataNascimento: Date,
        paciente_enumSexoBiologico: String,
        paciente_racaCor_codigo: Number,
        paciente_racaCor_valor: String,
        paciente_endereco_coIbgeMunicipio: String,
        paciente_endereco_coPais: String,
        paciente_endereco_nmMunicipio: String,
        paciente_endereco_nmPais: String,
        paciente_endereco_uf: String,
        paciente_endereco_cep: String,
        paciente_nacionalidade_enumNacionalidade: String,
        estabelecimento_valor: Number,
        estabelecimento_razaoSocial: String,
        estalecimento_noFantasia: String,
        estabelecimento_municipio_codigo: Number,
        estabelecimento_municipio_nome: String,
        estabelecimento_uf: String,
        vacina_grupoAtendimento_codigo: Number,
        vacina_grupoAtendimento_nome: String,
        vacina_categoria_codigo: Number,
        vacina_categoria_nome: String,
        vacina_lote: String,
        vacina_fabricante_nome: String,
        vacina_fabricante_referencia: String,
        vacina_dataAplicacao: Date,
        vacina_descricao_dose: String,
        vacina_codigo: Number,
        vacina_nome: String,
        sistema_origem: String
    },
    { timestamps: true }
)

export default mongoose.model('Vaccination', Vaccination)
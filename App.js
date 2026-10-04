import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, FlatList, TouchableOpacity,
  TextInput, Modal, Alert, SafeAreaView, KeyboardAvoidingView, Platform, StatusBar,
  ScrollView, ActivityIndicator
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

const COLORS = {
  background: '#12141C',
  card: '#1B1F2A',
  text: '#F2F4F8',
  textSecondary: '#9AA3B5',
  primary: '#7B93FF',
  primaryStrong: '#4263EB',
  onPrimary: '#FFFFFF',
  danger: '#FF6B6B',
  success: '#34C38F',
  warning: '#F5A524',
  border: '#2A3040',
  input: '#252A37',
  overlay: 'rgba(8, 10, 16, 0.75)',
  header: '#12141C'
};

// Chave ÚNICA e PERMANENTE para storage - NUNCA mudar
const STORAGE_KEY = '@meus_treinos_usuario_v1';

const MAX_SERIES = 20;
const DIA_MS = 1000 * 60 * 60 * 24;

const gerarId = () => `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

const obterDataValida = (data) => (!data || isNaN(new Date(data).getTime())) ? new Date() : new Date(data);

const inicioDoDia = (data) => {
  const d = obterDataValida(data);
  d.setHours(0, 0, 0, 0);
  return d;
};

const formatarData = (data) => obterDataValida(data).toLocaleDateString('pt-BR');

const paraValorInputData = (data) => {
  const d = obterDataValida(data);
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
};

// "AAAA-MM-DD" precisa virar data local; new Date("AAAA-MM-DD") interpreta como UTC e pode voltar um dia.
const deValorInputData = (valor) => {
  const [ano, mes, dia] = (valor || '').split('-').map(Number);
  if (!ano || !mes || !dia) return null;
  return new Date(ano, mes - 1, dia);
};

const calcularTotalTreinos = (inicio, fim, freq) => {
  const diffDays = Math.round(Math.abs(inicioDoDia(fim) - inicioDoDia(inicio)) / DIA_MS) + 1;
  const totalTreinos = Math.ceil((diffDays / 7) * freq);
  return Math.max(totalTreinos, 1);
};

const ehInteiroPositivo = (texto) => /^\d+$/.test(texto) && Number(texto) > 0;

// No navegador, Alert.alert do react-native-web não faz nada.
const avisar = (titulo, mensagem) => {
  if (Platform.OS === 'web') {
    window.alert(`${titulo}\n\n${mensagem}`);
    return;
  }
  Alert.alert(titulo, mensagem);
};

const confirmar = (titulo, mensagem, textoConfirmar, aoConfirmar) => {
  if (Platform.OS === 'web') {
    if (window.confirm(`${titulo}\n\n${mensagem}`)) aoConfirmar();
    return;
  }
  Alert.alert(titulo, mensagem, [
    { text: 'Cancelar', style: 'cancel' },
    { text: textoConfirmar, onPress: aoConfirmar, style: 'destructive' }
  ]);
};

const normalizarCiclos = (dados) => {
  if (!Array.isArray(dados)) throw new Error('Formato de dados inválido');
  const comoLista = (valor) => (Array.isArray(valor) ? valor.filter(item => item && typeof item === 'object') : []);
  const comoTexto = (valor) => (valor === null || valor === undefined ? '' : String(valor));

  return comoLista(dados).map(ciclo => ({
    ...ciclo,
    id: comoTexto(ciclo.id) || gerarId(),
    nome: comoTexto(ciclo.nome),
    dataInicio: obterDataValida(ciclo.dataInicio).toISOString(),
    dataFim: obterDataValida(ciclo.dataFim).toISOString(),
    frequenciaSemanal: Number(ciclo.frequenciaSemanal) || 1,
    metaTotal: Number(ciclo.metaTotal) || 1,
    treinos: comoLista(ciclo.treinos).map(treino => ({
      ...treino,
      id: comoTexto(treino.id) || gerarId(),
      nome: comoTexto(treino.nome),
      datasExecucao: Array.isArray(treino.datasExecucao) ? treino.datasExecucao : [],
      exercicios: comoLista(treino.exercicios).map(exercicio => ({
        ...exercicio,
        id: comoTexto(exercicio.id) || gerarId(),
        nome: comoTexto(exercicio.nome),
        tempo: comoTexto(exercicio.tempo),
        velocidade: comoTexto(exercicio.velocidade),
        horario: comoTexto(exercicio.horario),
        series: comoLista(exercicio.series).map((serie, indice) => ({
          ...serie,
          id: comoTexto(serie.id) || gerarId(),
          numero: indice + 1,
          repeticoes: comoTexto(serie.repeticoes),
          carga: comoTexto(serie.carga),
        })),
      })),
    })),
  }));
};

const clonarTreino = (treino) => {
  const agora = new Date().toISOString();
  return {
    ...treino,
    id: gerarId(),
    datasExecucao: [],
    dataCriacao: agora,
    exercicios: treino.exercicios.map(exercicio => ({
      ...exercicio,
      id: gerarId(),
      series: exercicio.series.map(serie => ({ ...serie, id: gerarId(), dataRegistro: agora }))
    }))
  };
};

const renumerarSeries = (series) => series.map((serie, indice) => ({ ...serie, numero: indice + 1 }));

const estiloInputDataWeb = {
  backgroundColor: 'transparent',
  color: COLORS.text,
  border: 'none',
  outline: 'none',
  fontSize: 15,
  fontFamily: 'inherit',
  colorScheme: 'dark',
  textAlign: 'center',
  width: '100%',
  marginTop: 4,
  cursor: 'pointer',
};

function CampoData({ rotulo, valor, minimo, onSelecionar, onAbrir }) {
  if (Platform.OS === 'web') {
    return (
      <View style={styles.btnData}>
        <Text style={styles.rotuloData}>{rotulo}</Text>
        {React.createElement('input', {
          type: 'date',
          value: paraValorInputData(valor),
          min: minimo ? paraValorInputData(minimo) : undefined,
          'aria-label': rotulo,
          style: estiloInputDataWeb,
          onChange: (evento) => {
            const data = deValorInputData(evento.target.value);
            if (data) onSelecionar(data);
          },
        })}
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={styles.btnData}
      onPress={onAbrir}
      accessibilityRole="button"
      accessibilityLabel={`${rotulo}: ${formatarData(valor)}`}>
      <Text style={styles.rotuloData}>{rotulo}</Text>
      <Text style={styles.btnDataTexto}>{formatarData(valor)}</Text>
    </TouchableOpacity>
  );
}

function ActionButton({ icon, color, onPress, label, accessibilityLabel }) {
  return (
    <TouchableOpacity
      style={styles.actionButton}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}>
      <Ionicons name={icon} size={18} color={color} />
      {label && <Text style={[styles.actionButtonText, { color }]}>{label}</Text>}
    </TouchableOpacity>
  );
}

export default function App() {
  const [ciclos, setCiclos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState(false);
  const ciclosRef = useRef([]);
  const filaGravacao = useRef(Promise.resolve());
  const gravacaoBloqueada = useRef(true);

  const [modalCicloVisible, setModalCicloVisible] = useState(false);
  const [modalTreinoVisible, setModalTreinoVisible] = useState(false);
  const [modalExercicioVisible, setModalExercicioVisible] = useState(false);
  const [modalSerieVisible, setModalSerieVisible] = useState(false);
  
  const [cicloSelecionadoId, setCicloSelecionadoId] = useState(null);
  const [treinoSelecionadoId, setTreinoSelecionadoId] = useState(null);
  const [exercicioSelecionadoId, setExercicioSelecionadoId] = useState(null);
  const [serieSendoEditadaId, setSerieSendoEditadaId] = useState(null);

  // Estado para controlar quais exercícios estão expandidos
  const [exerciciosExpandidos, setExerciciosExpandidos] = useState({});

  // Estados dos inputs
  const [nomeCiclo, setNomeCiclo] = useState('');
  const [dataInicio, setDataInicio] = useState(() => inicioDoDia(new Date()));
  const [dataFim, setDataFim] = useState(() => inicioDoDia(new Date()));
  const [treinosPorSemana, setTreinosPorSemana] = useState(''); 
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState('inicio');
  const [nomeTreino, setNomeTreino] = useState('');
  
  // Estados para exercício
  const [nomeEx, setNomeEx] = useState('');
  const [seriesEx, setSeriesEx] = useState('');
  const [repsEx, setRepsEx] = useState('');
  const [tempoEx, setTempoEx] = useState('');
  const [velocidadeEx, setVelocidadeEx] = useState('');
  const [horarioEx, setHorarioEx] = useState('');
  const [cargaEx, setCargaEx] = useState('');
  const [padroesOriginaisEx, setPadroesOriginaisEx] = useState({ repeticoes: '', carga: '' });
  
  // Estados para série individual
  const [serieNumero, setSerieNumero] = useState('');
  const [serieReps, setSerieReps] = useState('');
  const [serieCarga, setSerieCarga] = useState('');
  
  const [idExSendoEditado, setIdExSendoEditado] = useState(null);
  const [idCicloSendoEditado, setIdCicloSendoEditado] = useState(null);
  const [idTreinoSendoEditado, setIdTreinoSendoEditado] = useState(null);

  const cicloSelecionado = ciclos.find(c => c.id === cicloSelecionadoId) || null;
  const treinoSelecionado = cicloSelecionado?.treinos.find(t => t.id === treinoSelecionadoId) || null;

  useEffect(() => { 
    carregarDados(); 
  }, []);

  const carregarDados = async () => {
    setCarregando(true);
    try {
      const valor = await AsyncStorage.getItem(STORAGE_KEY);
      const dados = valor !== null ? normalizarCiclos(JSON.parse(valor)) : [];
      ciclosRef.current = dados;
      setCiclos(dados);
      setErroCarregamento(false);
      gravacaoBloqueada.current = false;
    } catch (e) { 
      // Não liberar gravação: salvar agora substituiria os dados que não conseguimos ler.
      gravacaoBloqueada.current = true;
      setErroCarregamento(true);
      console.log(e);
    } finally {
      setCarregando(false);
    }
  };

  const atualizarCiclos = (transformar) => {
    if (gravacaoBloqueada.current) {
      avisar("Erro", "Os dados salvos não foram carregados. Tente carregar novamente antes de fazer alterações.");
      return;
    }
    const novosCiclos = transformar(ciclosRef.current);
    ciclosRef.current = novosCiclos;
    setCiclos(novosCiclos);

    const json = JSON.stringify(novosCiclos);
    filaGravacao.current = filaGravacao.current
      .then(() => AsyncStorage.setItem(STORAGE_KEY, json))
      .catch((e) => {
        console.log(e);
        avisar("Erro", "Não foi possível salvar os dados.");
      });
  };

  const atualizarCiclo = (cicloId, transformar) =>
    atualizarCiclos(lista => lista.map(c => (c.id === cicloId ? transformar(c) : c)));

  const atualizarTreino = (cicloId, treinoId, transformar) =>
    atualizarCiclo(cicloId, c => ({
      ...c,
      treinos: c.treinos.map(t => (t.id === treinoId ? transformar(t) : t))
    }));

  const atualizarExercicio = (cicloId, treinoId, exercicioId, transformar) =>
    atualizarTreino(cicloId, treinoId, t => ({
      ...t,
      exercicios: t.exercicios.map(ex => (ex.id === exercicioId ? transformar(ex) : ex))
    }));

  const aplicarData = (modo, data) => {
    const novaData = inicioDoDia(data);
    if (modo === 'inicio') {
      setDataInicio(novaData);
      setDataFim(fimAtual => (novaData > fimAtual ? novaData : fimAtual));
    } else {
      setDataFim(novaData);
    }
  };

  const onDateChange = (event, selectedDate) => {
    if (Platform.OS !== 'ios') setShowDatePicker(false);
    if (event?.type === 'dismissed' || !selectedDate) return;
    aplicarData(datePickerMode, selectedDate);
  };

  const abrirSeletorData = (modo) => {
    setDatePickerMode(modo);
    setShowDatePicker(true);
  };

  const abrirNovoCiclo = () => {
    fecharModalCiclo();
    setModalCicloVisible(true);
  };

  const abrirEdicaoCiclo = (ciclo) => {
    setIdCicloSendoEditado(ciclo.id);
    setNomeCiclo(ciclo.nome);
    setDataInicio(inicioDoDia(ciclo.dataInicio));
    setDataFim(inicioDoDia(ciclo.dataFim));
    setTreinosPorSemana(String(ciclo.frequenciaSemanal || ''));
    setShowDatePicker(false);
    setModalCicloVisible(true);
  };

  const salvarCiclo = () => {
    const nome = nomeCiclo.trim();
    const freqTexto = treinosPorSemana.trim();
    if (!nome) {
      avisar("Erro", "Informe o nome do ciclo.");
      return;
    }
    if (!ehInteiroPositivo(freqTexto) || Number(freqTexto) > 7) {
      avisar("Erro", "Treinos por semana deve ser um número inteiro de 1 a 7.");
      return;
    }

    const inicio = inicioDoDia(dataInicio);
    const fim = inicioDoDia(dataFim);
    if (fim < inicio) {
      avisar("Erro", "A data final não pode ser anterior à data inicial.");
      return;
    }

    const freqInt = Number(freqTexto);
    const dadosCiclo = {
      nome,
      dataInicio: inicio.toISOString(),
      dataFim: fim.toISOString(),
      metaTotal: calcularTotalTreinos(inicio, fim, freqInt),
      frequenciaSemanal: freqInt,
    };

    if (idCicloSendoEditado) {
      atualizarCiclo(idCicloSendoEditado, c => ({ ...c, ...dadosCiclo }));
    } else {
      atualizarCiclos(lista => [...lista, { id: gerarId(), ...dadosCiclo, treinos: [] }]);
    }
    
    fecharModalCiclo();
  };

  const deletarCiclo = (id) => {
    confirmar("Excluir Ciclo", "Deseja remover este ciclo e todos os seus treinos?", "Excluir", () => {
      atualizarCiclos(lista => lista.filter(c => c.id !== id));
      if (cicloSelecionadoId === id) {
        setCicloSelecionadoId(null);
        setTreinoSelecionadoId(null);
      }
    });
  };

  const copiarCiclo = (cicloParaCopiar) => {
    // A cópia começa hoje e mantém a duração do ciclo original.
    const duracaoDias = Math.max(0, Math.round(
      (inicioDoDia(cicloParaCopiar.dataFim) - inicioDoDia(cicloParaCopiar.dataInicio)) / DIA_MS
    ));
    const inicio = inicioDoDia(new Date());
    const fim = new Date(inicio);
    fim.setDate(fim.getDate() + duracaoDias);

    const novoCiclo = {
      ...cicloParaCopiar,
      id: gerarId(),
      nome: `${cicloParaCopiar.nome} (Cópia)`,
      dataInicio: inicio.toISOString(),
      dataFim: fim.toISOString(),
      metaTotal: calcularTotalTreinos(inicio, fim, cicloParaCopiar.frequenciaSemanal),
      treinos: cicloParaCopiar.treinos.map(clonarTreino)
    };
    
    atualizarCiclos(lista => [...lista, novoCiclo]);
  };

  const salvarTreino = () => {
    const nome = nomeTreino.trim();
    if (!nome || !cicloSelecionadoId) {
      avisar("Erro", "Nome do treino é obrigatório.");
      return;
    }
    
    if (idTreinoSendoEditado) {
      atualizarTreino(cicloSelecionadoId, idTreinoSendoEditado, t => ({ ...t, nome }));
    } else {
      const novoTreino = {
        id: gerarId(),
        nome,
        dataCriacao: new Date().toISOString(),
        datasExecucao: [],
        exercicios: []
      };
      atualizarCiclo(cicloSelecionadoId, c => ({ ...c, treinos: [...c.treinos, novoTreino] }));
    }

    fecharModalTreino();
  };

  const deletarTreino = (treinoId) => {
    const cicloId = cicloSelecionadoId;
    confirmar("Excluir Treino", "Deseja remover este treino e todos os seus exercícios?", "Excluir", () => {
      atualizarCiclo(cicloId, c => ({ ...c, treinos: c.treinos.filter(t => t.id !== treinoId) }));
      if (treinoSelecionadoId === treinoId) setTreinoSelecionadoId(null);
    });
  };

  const copiarTreino = (treinoParaCopiar) => {
    const novoTreino = { ...clonarTreino(treinoParaCopiar), nome: `${treinoParaCopiar.nome} (Cópia)` };
    atualizarCiclo(cicloSelecionadoId, c => ({ ...c, treinos: [...c.treinos, novoTreino] }));
  };

  const moverTreino = (index, direcao) => {
    if (!cicloSelecionadoId) return;
    atualizarCiclo(cicloSelecionadoId, c => {
      const novosTreinos = [...c.treinos];
      const novoIndex = direcao === 'up' ? index - 1 : index + 1;
      if (novoIndex < 0 || novoIndex >= novosTreinos.length) return c;
      [novosTreinos[index], novosTreinos[novoIndex]] = [novosTreinos[novoIndex], novosTreinos[index]];
      return { ...c, treinos: novosTreinos };
    });
  };

  const foiFeitoHoje = (treino) => {
    if (!treino.datasExecucao || treino.datasExecucao.length === 0) return false;
    const hoje = new Date().toDateString();
    return treino.datasExecucao.some(data => new Date(data).toDateString() === hoje);
  };

  const contarExecucoes = (treino) => {
    return treino.datasExecucao ? treino.datasExecucao.length : 0;
  };

  const alternarExecucaoTreino = (treinoId) => {
    if (!cicloSelecionadoId) return;
    atualizarTreino(cicloSelecionadoId, treinoId, t => {
      const hoje = new Date().toDateString();
      if (foiFeitoHoje(t)) {
        return { ...t, datasExecucao: t.datasExecucao.filter(data => new Date(data).toDateString() !== hoje) };
      }
      return { ...t, datasExecucao: [...(t.datasExecucao || []), new Date().toISOString()] };
    });
  };

  const abrirNovoExercicio = () => {
    fecharModalExercicio();
    setModalExercicioVisible(true);
  };

  const abrirEdicaoExercicio = (exercicio) => {
    const primeiraSerie = exercicio.series[0];
    const repsPadrao = primeiraSerie ? primeiraSerie.repeticoes : '';
    const cargaPadrao = primeiraSerie ? primeiraSerie.carga : '';
    setIdExSendoEditado(exercicio.id);
    setNomeEx(exercicio.nome);
    setSeriesEx(String(exercicio.series.length));
    setRepsEx(repsPadrao);
    setCargaEx(cargaPadrao);
    setPadroesOriginaisEx({ repeticoes: repsPadrao, carga: cargaPadrao });
    setTempoEx(exercicio.tempo || '');
    setVelocidadeEx(exercicio.velocidade || '');
    setHorarioEx(exercicio.horario || '');
    setModalExercicioVisible(true);
  };

  const salvarExercicio = () => {
    const nome = nomeEx.trim();
    if (!nome) {
      avisar("Erro", "Nome do exercício é obrigatório.");
      return;
    }
    if (!cicloSelecionadoId || !treinoSelecionadoId) return;

    const seriesTexto = seriesEx.trim();
    const numSeries = seriesTexto === '' ? 0 : Number(seriesTexto);
    if (!/^\d*$/.test(seriesTexto) || numSeries > MAX_SERIES) {
      avisar("Erro", `Número de séries deve ser um número inteiro de 0 a ${MAX_SERIES}.`);
      return;
    }

    const repeticoes = repsEx.trim();
    if (repeticoes !== '' && !ehInteiroPositivo(repeticoes)) {
      avisar("Erro", "Repetições padrão deve ser um número inteiro maior que zero.");
      return;
    }
    const carga = cargaEx.trim();
    const agora = new Date().toISOString();
    const criarSerie = (numero) => ({ id: gerarId(), numero, repeticoes, carga, dataRegistro: agora });

    const camposExercicio = {
      nome,
      tempo: tempoEx.trim(),
      velocidade: velocidadeEx.trim(),
      horario: horarioEx.trim(),
    };

    if (idExSendoEditado) {
      const mudouReps = repeticoes !== padroesOriginaisEx.repeticoes;
      const mudouCarga = carga !== padroesOriginaisEx.carga;
      atualizarExercicio(cicloSelecionadoId, treinoSelecionadoId, idExSendoEditado, ex => {
        // Séries ajustadas individualmente mantêm seus valores; só as que seguiam o padrão antigo recebem o novo.
        const seriesMantidas = ex.series.slice(0, numSeries).map(serie => ({
          ...serie,
          repeticoes: mudouReps && serie.repeticoes === padroesOriginaisEx.repeticoes ? repeticoes : serie.repeticoes,
          carga: mudouCarga && serie.carga === padroesOriginaisEx.carga ? carga : serie.carga,
        }));
        const seriesNovas = [];
        for (let i = seriesMantidas.length + 1; i <= numSeries; i++) seriesNovas.push(criarSerie(i));
        return { ...ex, ...camposExercicio, series: renumerarSeries([...seriesMantidas, ...seriesNovas]) };
      });
    } else {
      const novoExercicio = {
        id: gerarId(),
        ...camposExercicio,
        series: Array.from({ length: numSeries }, (_, i) => criarSerie(i + 1)),
      };
      atualizarTreino(cicloSelecionadoId, treinoSelecionadoId, t => ({
        ...t,
        exercicios: [...t.exercicios, novoExercicio]
      }));
    }

    fecharModalExercicio();
  };

  const salvarSerie = () => {
    if (!cicloSelecionadoId || !treinoSelecionadoId || !exercicioSelecionadoId) return;
    
    const repeticoes = serieReps.trim();
    if (!ehInteiroPositivo(repeticoes)) {
      avisar("Erro", "Número de repetições deve ser um número inteiro maior que zero.");
      return;
    }
    const carga = serieCarga.trim();
    const agora = new Date().toISOString();

    if (!serieSendoEditadaId) {
      const exercicioAtual = treinoSelecionado?.exercicios.find(ex => ex.id === exercicioSelecionadoId);
      if (exercicioAtual && exercicioAtual.series.length >= MAX_SERIES) {
        avisar("Erro", `Cada exercício pode ter no máximo ${MAX_SERIES} séries.`);
        return;
      }
    }

    atualizarExercicio(cicloSelecionadoId, treinoSelecionadoId, exercicioSelecionadoId, ex => {
      if (serieSendoEditadaId) {
        return {
          ...ex,
          series: ex.series.map(s => (s.id === serieSendoEditadaId ? { ...s, repeticoes, carga, dataRegistro: agora } : s))
        };
      }
      const novaSerie = { id: gerarId(), numero: ex.series.length + 1, repeticoes, carga, dataRegistro: agora };
      return { ...ex, series: [...ex.series, novaSerie] };
    });

    fecharModalSerie();
  };

  const moverExercicio = (index, direcao) => {
    if (!cicloSelecionadoId || !treinoSelecionadoId) return;
    atualizarTreino(cicloSelecionadoId, treinoSelecionadoId, t => {
      const novosExercicios = [...t.exercicios];
      const novoIndex = direcao === 'up' ? index - 1 : index + 1;
      if (novoIndex < 0 || novoIndex >= novosExercicios.length) return t;
      [novosExercicios[index], novosExercicios[novoIndex]] = [novosExercicios[novoIndex], novosExercicios[index]];
      return { ...t, exercicios: novosExercicios };
    });
  };

  const deletarExercicio = (exId) => {
    const cicloId = cicloSelecionadoId;
    const treinoId = treinoSelecionadoId;
    confirmar("Excluir Exercício", "Remover este exercício?", "Excluir", () => {
      atualizarTreino(cicloId, treinoId, t => ({ ...t, exercicios: t.exercicios.filter(ex => ex.id !== exId) }));
      setExerciciosExpandidos(prev => {
        const novo = { ...prev };
        delete novo[exId];
        return novo;
      });
    });
  };

  const deletarSerie = (exercicio, serieId) => {
    const cicloId = cicloSelecionadoId;
    const treinoId = treinoSelecionadoId;
    confirmar("Remover Série", "Deseja remover esta série?", "Remover", () => {
      atualizarExercicio(cicloId, treinoId, exercicio.id, ex => ({
        ...ex,
        series: renumerarSeries(ex.series.filter(s => s.id !== serieId))
      }));
    });
  };

  const abrirModalSerie = (exercicio, serie = null, indice = null) => {
    setExercicioSelecionadoId(exercicio.id);
    if (serie) {
      setSerieSendoEditadaId(serie.id);
      setSerieNumero(String(indice + 1));
      setSerieReps(serie.repeticoes);
      setSerieCarga(serie.carga);
    } else {
      setSerieSendoEditadaId(null);
      setSerieNumero(String(exercicio.series.length + 1));
      setSerieReps('');
      setSerieCarga('');
    }
    setModalSerieVisible(true);
  };

  const fecharModalCiclo = () => { 
    setNomeCiclo(''); 
    setDataInicio(inicioDoDia(new Date())); 
    setDataFim(inicioDoDia(new Date())); 
    setTreinosPorSemana(''); 
    setIdCicloSendoEditado(null); 
    setShowDatePicker(false);
    setModalCicloVisible(false); 
  };
  
  const fecharModalTreino = () => { 
    setNomeTreino(''); 
    setIdTreinoSendoEditado(null); 
    setModalTreinoVisible(false); 
  };
  
  const fecharModalExercicio = () => { 
    setNomeEx(''); 
    setSeriesEx(''); 
    setRepsEx(''); 
    setTempoEx(''); 
    setVelocidadeEx(''); 
    setHorarioEx(''); 
    setCargaEx('');
    setPadroesOriginaisEx({ repeticoes: '', carga: '' });
    setIdExSendoEditado(null); 
    setModalExercicioVisible(false); 
  };

  const fecharModalSerie = () => {
    setExercicioSelecionadoId(null);
    setSerieSendoEditadaId(null);
    setSerieNumero('');
    setSerieReps('');
    setSerieCarga('');
    setModalSerieVisible(false);
  };

  const fecharDetalheCiclo = () => {
    setTreinoSelecionadoId(null);
    setCicloSelecionadoId(null);
  };

  const fecharDetalheTreino = () => {
    setTreinoSelecionadoId(null);
    setExerciciosExpandidos({});
  };

  const formatarDetalhesExercicio = (item) => {
    const partes = [];
    if (item.horario && item.horario.trim() !== '') partes.push(`${item.horario.trim()}`);
    if (item.tempo && item.tempo.trim() !== '') partes.push(`${item.tempo.trim()}`);
    if (item.velocidade && item.velocidade.trim() !== '') partes.push(`${item.velocidade.trim()}`);
    return partes.join(' / ');
  };

  // Função para alternar a expansão de um exercício
  const toggleExercicioExpandido = (exercicioId) => {
    setExerciciosExpandidos(prev => ({
      ...prev,
      [exercicioId]: !prev[exercicioId]
    }));
  };

  const renderEstadoInicial = () => {
    if (carregando) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.emptySubText}>Carregando seus ciclos...</Text>
        </View>
      );
    }
    if (erroCarregamento) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="alert-circle-outline" size={60} color={COLORS.danger} />
          <Text style={styles.emptyText}>Não foi possível carregar os dados</Text>
          <Text style={styles.emptySubText}>Seus dados não foram alterados.</Text>
          <TouchableOpacity style={styles.btnTentarNovamente} onPress={carregarDados} accessibilityRole="button">
            <Text style={styles.modalButtonTexto}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="fitness-outline" size={60} color={COLORS.textSecondary} />
        <Text style={styles.emptyText}>Nenhum ciclo criado ainda</Text>
        <Text style={styles.emptySubText}>Toque no botão + para começar</Text>
      </View>
    );
  };

  const podeEditar = !carregando && !erroCarregamento;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      <Text style={styles.header}>Meus Ciclos</Text>
      <FlatList
        data={podeEditar ? ciclos : []}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.flatListContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEstadoInicial}
        renderItem={({ item }) => {
          const totalExecucoes = item.treinos.reduce((acc, treino) => acc + contarExecucoes(treino), 0);
          const metaTotal = item.metaTotal || 1;
          const progresso = (totalExecucoes / metaTotal) * 100;
          
          return (
            <View style={styles.cardCiclo}>
                <View style={styles.row}>
                  <TouchableOpacity
                    onPress={() => setCicloSelecionadoId(item.id)}
                    style={{flex: 1}}
                    accessibilityRole="button"
                    accessibilityLabel={`Abrir ciclo ${item.nome}`}>
                    <Text style={styles.tituloCiclo} numberOfLines={2}>{item.nome}</Text>
                    <Text style={styles.textoData}>{formatarData(item.dataInicio)} - {formatarData(item.dataFim)}</Text>
                  </TouchableOpacity>
                  <View style={styles.actionButtonsContainer}>
                    <ActionButton
                      icon="copy-outline"
                      color={COLORS.textSecondary}
                      accessibilityLabel="Copiar ciclo"
                      onPress={() => copiarCiclo(item)}
                    />
                    <ActionButton
                      icon="pencil-outline"
                      color={COLORS.primary}
                      accessibilityLabel="Editar ciclo"
                      onPress={() => abrirEdicaoCiclo(item)}
                    />
                    <ActionButton
                      icon="trash-outline"
                      color={COLORS.danger}
                      accessibilityLabel="Excluir ciclo"
                      onPress={() => deletarCiclo(item.id)}
                    />
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => setCicloSelecionadoId(item.id)}
                  accessible={false}>
                  <View style={styles.containerProgresso}>
                    <View style={[styles.barraProgresso, { width: `${Math.min(progresso, 100)}%` }]} />
                  </View>
                  <Text style={styles.textoProgresso}>{totalExecucoes} / {metaTotal} treinos realizados ({item.frequenciaSemanal}x/sem)</Text>
                </TouchableOpacity>
            </View>
          );
        }}
      />
      {podeEditar && (
        <TouchableOpacity
          style={styles.btnFlutuante}
          onPress={abrirNovoCiclo}
          accessibilityRole="button"
          accessibilityLabel="Novo ciclo">
          <Ionicons name="add" size={32} color={COLORS.onPrimary} />
        </TouchableOpacity>
      )}

      {/* MODAL DETALHE DO CICLO (LISTA DE TREINOS) */}
      <Modal visible={!!cicloSelecionado} animationType="slide" onRequestClose={fecharDetalheCiclo}>
        <SafeAreaView style={styles.container}>
          <View style={styles.headerDetalhe}>
            <TouchableOpacity onPress={fecharDetalheCiclo} accessibilityRole="button" accessibilityLabel="Voltar">
              <Ionicons name="arrow-back" size={28} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={styles.headerMenor} numberOfLines={1}>{cicloSelecionado?.nome}</Text>
            <View style={{width: 28}} />
          </View>
          <FlatList
            data={cicloSelecionado?.treinos || []}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.flatListContent}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
                <View>
                    <Text style={styles.subHeaderDetalhe}>
                      {formatarData(cicloSelecionado?.dataInicio)} até {formatarData(cicloSelecionado?.dataFim)}
                    </Text>
                    <TouchableOpacity 
                      style={styles.btnAdicionar} 
                      accessibilityRole="button"
                      onPress={() => {
                        setNomeTreino('');
                        setIdTreinoSendoEditado(null);
                        setModalTreinoVisible(true);
                      }}>
                      <Ionicons name="add-circle-outline" size={24} color={COLORS.primary} />
                      <Text style={styles.textAdicionar}>Adicionar Treino</Text>
                    </TouchableOpacity>
                </View>
            }
            ListEmptyComponent={
              <Text style={styles.listaVaziaTexto}>Nenhum treino neste ciclo ainda.</Text>
            }
            renderItem={({ item, index }) => {
              const foiHoje = foiFeitoHoje(item);
              const totalExecucoes = contarExecucoes(item);
              const ultimo = index === (cicloSelecionado.treinos.length - 1);
              
              return (
                <View style={styles.cardTreinoContainer}>
                  <View style={styles.reorderContainer}>
                    <TouchableOpacity 
                      onPress={() => moverTreino(index, 'up')} 
                      style={[styles.btnArrow, index === 0 && {opacity: 0.3}]} 
                      disabled={index === 0}
                      accessibilityRole="button"
                      accessibilityLabel="Mover treino para cima">
                        <Ionicons name="chevron-up" size={20} color={COLORS.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      onPress={() => moverTreino(index, 'down')} 
                      style={[styles.btnArrow, ultimo && {opacity: 0.3}]} 
                      disabled={ultimo}
                      accessibilityRole="button"
                      accessibilityLabel="Mover treino para baixo">
                        <Ionicons name="chevron-down" size={20} color={COLORS.primary} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.cardContent}>
                    <View style={styles.row}>
                      <TouchableOpacity
                        style={{flex: 1}}
                        accessibilityRole="button"
                        accessibilityLabel={`Abrir treino ${item.nome}`}
                        onPress={() => {
                          setTreinoSelecionadoId(item.id);
                          // Resetar expansões quando abrir um novo treino
                          setExerciciosExpandidos({});
                        }}>
                        <Text style={styles.nomeEx} numberOfLines={2}>{item.nome}</Text>
                        <Text style={styles.detalheEx}>
                          {item.exercicios.length} Exercícios • {totalExecucoes}x realizado
                        </Text>
                      </TouchableOpacity>
                      <View style={styles.statusContainer}>
                        <Text style={[styles.textoFinalizado, foiHoje && {color: COLORS.success}]}>
                          {foiHoje ? "Feito hoje" : "Pendente"}
                        </Text>
                        <TouchableOpacity 
                          style={[styles.checkbox, foiHoje && styles.checkboxChecked]} 
                          onPress={() => alternarExecucaoTreino(item.id)}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: foiHoje }}
                          accessibilityLabel={`Marcar ${item.nome} como feito hoje`}>
                            {foiHoje && <Ionicons name="checkmark" size={20} color={COLORS.onPrimary} />}
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  <View style={styles.actionButtonsRow}>
                    <ActionButton
                      icon="pencil-outline"
                      color={COLORS.primary}
                      label="Editar"
                      onPress={() => {
                        setIdTreinoSendoEditado(item.id);
                        setNomeTreino(item.nome);
                        setModalTreinoVisible(true);
                      }}
                    />
                    <ActionButton
                      icon="copy-outline"
                      color={COLORS.textSecondary}
                      label="Copiar"
                      onPress={() => copiarTreino(item)}
                    />
                    <ActionButton
                      icon="trash-outline"
                      color={COLORS.danger}
                      label="Excluir"
                      onPress={() => deletarTreino(item.id)}
                    />
                  </View>
                </View>
              );
            }}
          />
        </SafeAreaView>
      </Modal>

      {/* MODAL DETALHE DO TREINO (LISTA DE EXERCÍCIOS) */}
      <Modal visible={!!treinoSelecionado} animationType="slide" onRequestClose={fecharDetalheTreino}>
        <SafeAreaView style={styles.container}>
          <View style={styles.headerDetalhe}>
            <TouchableOpacity onPress={fecharDetalheTreino} accessibilityRole="button" accessibilityLabel="Voltar">
              <Ionicons name="arrow-back" size={28} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={styles.headerMenor} numberOfLines={1}>{treinoSelecionado?.nome}</Text>
            <View style={{width: 28}} />
          </View>
          
          <FlatList
            data={treinoSelecionado?.exercicios || []}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.flatListContent}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <TouchableOpacity 
                style={styles.btnAdicionar} 
                accessibilityRole="button"
                onPress={abrirNovoExercicio}>
                <Ionicons name="add-circle-outline" size={24} color={COLORS.primary} />
                <Text style={styles.textAdicionar}>Adicionar Exercício</Text>
              </TouchableOpacity>
            }
            ListEmptyComponent={
              <Text style={styles.listaVaziaTexto}>Nenhum exercício neste treino ainda.</Text>
            }
            renderItem={({ item, index }) => {
              const totalSeries = item.series.length;
              const estaExpandido = exerciciosExpandidos[item.id] || false;
              const ultimo = index === (treinoSelecionado.exercicios.length - 1);
              
              return (
                <View style={styles.cardExercicioContainer}>
                  <View style={styles.reorderContainer}>
                    <TouchableOpacity 
                      onPress={() => moverExercicio(index, 'up')} 
                      style={[styles.btnArrow, index === 0 && {opacity: 0.3}]} 
                      disabled={index === 0}
                      accessibilityRole="button"
                      accessibilityLabel="Mover exercício para cima">
                        <Ionicons name="chevron-up" size={20} color={COLORS.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      onPress={() => moverExercicio(index, 'down')} 
                      style={[styles.btnArrow, ultimo && {opacity: 0.3}]} 
                      disabled={ultimo}
                      accessibilityRole="button"
                      accessibilityLabel="Mover exercício para baixo">
                        <Ionicons name="chevron-down" size={20} color={COLORS.primary} />
                    </TouchableOpacity>
                  </View>
                  
                  <View style={styles.exerciseMainContent}>
                    <View style={styles.exerciseHeader}>
                      <TouchableOpacity 
                        style={styles.exerciseTitleContainer}
                        onPress={() => toggleExercicioExpandido(item.id)}
                        accessibilityRole="button"
                        accessibilityState={{ expanded: estaExpandido }}
                        accessibilityLabel={`${item.nome}, ${totalSeries} séries`}>
                        <Ionicons 
                          name={estaExpandido ? "chevron-down" : "chevron-forward"} 
                          size={20} 
                          color={COLORS.primary} 
                        />
                        <Text style={styles.nomeEx} numberOfLines={2}>{item.nome}</Text>
                      </TouchableOpacity>
                      
                      <View style={styles.exerciseActions}>
                        <ActionButton
                          icon="pencil-outline"
                          color={COLORS.primary}
                          accessibilityLabel="Editar exercício"
                          onPress={() => abrirEdicaoExercicio(item)}
                        />
                        <ActionButton
                          icon="trash-outline"
                          color={COLORS.danger}
                          accessibilityLabel="Excluir exercício"
                          onPress={() => deletarExercicio(item.id)}
                        />
                      </View>
                    </View>
                    
                    {formatarDetalhesExercicio(item) !== '' && (
                      <Text style={styles.detalheEx}>{formatarDetalhesExercicio(item)}</Text>
                    )}
                    
                    {/* Mostrar resumo mesmo quando fechado */}
                    <View style={styles.exerciseSummary}>
                      <Text style={styles.seriesTitle}>
                        Séries: {totalSeries}
                      </Text>
                    </View>
                    
                    {/* Conteúdo expandido */}
                    {estaExpandido && (
                      <View style={styles.seriesContainer}>
                        {item.series.map((serie, idx) => (
                          <View key={serie.id} style={styles.serieItem}>
                            <Text style={styles.serieNumero}>{idx + 1}ª série</Text>
                            
                            <Text style={styles.serieInfo}>
                              {serie.repeticoes ? `${serie.repeticoes} reps` : 'reps não definidas'}{serie.carga ? ` • ${serie.carga}` : ''}
                            </Text>
                            
                            <View style={styles.serieActions}>
                              <TouchableOpacity 
                                style={styles.serieActionBtn}
                                onPress={() => abrirModalSerie(item, serie, idx)}
                                accessibilityRole="button"
                                accessibilityLabel={`Editar ${idx + 1}ª série`}>
                                <Ionicons name="create-outline" size={18} color={COLORS.primary} />
                              </TouchableOpacity>
                              
                              <TouchableOpacity 
                                style={styles.serieActionBtn}
                                onPress={() => deletarSerie(item, serie.id)}
                                accessibilityRole="button"
                                accessibilityLabel={`Remover ${idx + 1}ª série`}>
                                <Ionicons name="close-outline" size={18} color={COLORS.danger} />
                              </TouchableOpacity>
                            </View>
                          </View>
                        ))}
                        
                        <TouchableOpacity 
                          style={styles.adicionarSerieBtn}
                          onPress={() => abrirModalSerie(item)}
                          accessibilityRole="button">
                          <Ionicons name="add-circle-outline" size={20} color={COLORS.primary} />
                          <Text style={styles.adicionarSerieText}>Adicionar Série</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>
              );
            }}
          />
        </SafeAreaView>
      </Modal>

      {/* MODAIS DE FORMULÁRIO */}
      <Modal visible={modalCicloVisible} transparent animationType="fade" onRequestClose={fecharModalCiclo}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalCentrado}>
          <ScrollView 
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <View style={styles.modalView}>
              <Text style={styles.modalTitulo}>{idCicloSendoEditado ? "Editar Ciclo" : "Novo Ciclo"}</Text>
              <TextInput 
                style={styles.input} 
                placeholder="Nome (ex: Foco Hipertrofia)" 
                placeholderTextColor={COLORS.textSecondary} 
                value={nomeCiclo} 
                onChangeText={setNomeCiclo} 
                maxLength={60}
                accessibilityLabel="Nome do ciclo"
              />
              <View style={styles.rowInput}>
                <CampoData
                  rotulo="Início"
                  valor={dataInicio}
                  onAbrir={() => abrirSeletorData('inicio')}
                  onSelecionar={(data) => aplicarData('inicio', data)}
                />
                <CampoData
                  rotulo="Fim"
                  valor={dataFim}
                  minimo={dataInicio}
                  onAbrir={() => abrirSeletorData('fim')}
                  onSelecionar={(data) => aplicarData('fim', data)}
                />
              </View>

              {showDatePicker && Platform.OS !== 'web' && (
                <DateTimePicker 
                  value={datePickerMode === 'inicio' ? dataInicio : dataFim} 
                  minimumDate={datePickerMode === 'fim' ? dataInicio : undefined}
                  mode="date" 
                  display="default" 
                  onChange={onDateChange} 
                  themeVariant="dark" 
                />
              )}
              
              <TextInput 
                style={styles.input} 
                placeholder="Treinos por semana (1 a 7)" 
                placeholderTextColor={COLORS.textSecondary} 
                value={treinosPorSemana} 
                onChangeText={setTreinosPorSemana} 
                keyboardType="number-pad" 
                maxLength={1}
                accessibilityLabel="Treinos por semana"
              />

              <View style={styles.modalButtonsContainer}>
                <TouchableOpacity style={styles.modalButtonSalvar} onPress={salvarCiclo} accessibilityRole="button">
                  <Text style={styles.modalButtonTexto}>Salvar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalButtonCancelar} onPress={fecharModalCiclo} accessibilityRole="button">
                  <Text style={styles.modalButtonTexto}>Cancelar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={modalTreinoVisible} transparent animationType="fade" onRequestClose={fecharModalTreino}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalCentrado}>
          <ScrollView 
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <View style={styles.modalView}>
              <Text style={styles.modalTitulo}>{idTreinoSendoEditado ? "Editar Treino" : "Novo Treino"}</Text>
              <TextInput 
                style={styles.input} 
                placeholder="Nome (ex: Treino A)" 
                placeholderTextColor={COLORS.textSecondary} 
                value={nomeTreino} 
                onChangeText={setNomeTreino} 
                maxLength={60}
                accessibilityLabel="Nome do treino"
              />
              <View style={styles.modalButtonsContainer}>
                <TouchableOpacity style={styles.modalButtonSalvar} onPress={salvarTreino} accessibilityRole="button">
                  <Text style={styles.modalButtonTexto}>Salvar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalButtonCancelar} onPress={fecharModalTreino} accessibilityRole="button">
                  <Text style={styles.modalButtonTexto}>Cancelar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={modalExercicioVisible} transparent animationType="fade" onRequestClose={fecharModalExercicio}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalCentrado}>
          <ScrollView 
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <View style={styles.modalView}>
              <Text style={styles.modalTitulo}>{idExSendoEditado ? "Editar" : "Novo"} Exercício</Text>
              
              <TextInput 
                style={styles.input} 
                placeholder="Nome (ex: Supino)" 
                placeholderTextColor={COLORS.textSecondary} 
                value={nomeEx} 
                onChangeText={setNomeEx} 
                maxLength={60}
                accessibilityLabel="Nome do exercício"
              />
              
              <TextInput 
                style={styles.input} 
                placeholder={`Número de séries (0 a ${MAX_SERIES})`} 
                placeholderTextColor={COLORS.textSecondary} 
                value={seriesEx} 
                onChangeText={setSeriesEx} 
                keyboardType="number-pad" 
                maxLength={2}
                accessibilityLabel="Número de séries"
              />
              
              <TextInput 
                style={styles.input} 
                placeholder="Repetições padrão (ex: 12)" 
                placeholderTextColor={COLORS.textSecondary} 
                value={repsEx} 
                onChangeText={setRepsEx} 
                keyboardType="number-pad" 
                maxLength={3}
                accessibilityLabel="Repetições padrão"
              />
              
              <TextInput 
                style={styles.input} 
                placeholder="Carga padrão (ex: 20kg)" 
                placeholderTextColor={COLORS.textSecondary} 
                value={cargaEx} 
                onChangeText={setCargaEx} 
                maxLength={20}
                accessibilityLabel="Carga padrão"
              />
              
              <TextInput 
                style={styles.input} 
                placeholder="Horário (ex: 19:00)" 
                placeholderTextColor={COLORS.textSecondary} 
                value={horarioEx} 
                onChangeText={setHorarioEx} 
                maxLength={20}
                accessibilityLabel="Horário"
              />
              
              <TextInput 
                style={styles.input} 
                placeholder="Tempo (ex: 60s)" 
                placeholderTextColor={COLORS.textSecondary} 
                value={tempoEx} 
                onChangeText={setTempoEx} 
                maxLength={20}
                accessibilityLabel="Tempo"
              />
              
              <TextInput 
                style={styles.input} 
                placeholder="Velocidade (ex: 2010)" 
                placeholderTextColor={COLORS.textSecondary} 
                value={velocidadeEx} 
                onChangeText={setVelocidadeEx} 
                maxLength={20}
                accessibilityLabel="Velocidade"
              />

              <View style={styles.modalButtonsContainer}>
                <TouchableOpacity style={styles.modalButtonSalvar} onPress={salvarExercicio} accessibilityRole="button">
                  <Text style={styles.modalButtonTexto}>Salvar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalButtonCancelar} onPress={fecharModalExercicio} accessibilityRole="button">
                  <Text style={styles.modalButtonTexto}>Cancelar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={modalSerieVisible} transparent animationType="fade" onRequestClose={fecharModalSerie}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalCentrado}>
          <ScrollView 
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <View style={styles.modalView}>
              <Text style={styles.modalTitulo}>
                {serieSendoEditadaId ? "Editar Série" : "Nova Série"}{serieNumero ? ` • ${serieNumero}ª` : ''}
              </Text>
              
              <TextInput 
                style={styles.input} 
                placeholder="Repetições realizadas" 
                placeholderTextColor={COLORS.textSecondary} 
                value={serieReps} 
                onChangeText={setSerieReps} 
                keyboardType="number-pad" 
                maxLength={3}
                accessibilityLabel="Repetições realizadas"
              />
              
              <TextInput 
                style={styles.input} 
                placeholder="Carga utilizada" 
                placeholderTextColor={COLORS.textSecondary} 
                value={serieCarga} 
                onChangeText={setSerieCarga} 
                maxLength={20}
                accessibilityLabel="Carga utilizada"
              />

              <View style={styles.modalButtonsContainer}>
                <TouchableOpacity style={styles.modalButtonSalvar} onPress={salvarSerie} accessibilityRole="button">
                  <Text style={styles.modalButtonTexto}>Salvar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalButtonCancelar} onPress={fecharModalSerie} accessibilityRole="button">
                  <Text style={styles.modalButtonTexto}>Cancelar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: COLORS.background, 
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  
  // Headers
  header: { 
    fontSize: 32, 
    fontWeight: 'bold', 
    color: COLORS.text, 
    marginTop: Platform.OS === 'ios' ? 20 : 10,
    marginBottom: 25,
    textAlign: 'center',
  },
  headerDetalhe: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    marginBottom: 20,
    marginTop: Platform.OS === 'ios' ? 20 : 10,
    paddingHorizontal: 5,
  },
  headerMenor: { 
    fontSize: 24, 
    fontWeight: 'bold', 
    color: COLORS.text, 
    flex: 1, 
    textAlign: 'center',
  },
  subHeaderDetalhe: { 
    color: COLORS.textSecondary, 
    fontSize: 14, 
    marginBottom: 20, 
    textAlign: 'center',
  },
  
  // FlatList content
  flatListContent: {
    paddingBottom: 100,
    paddingTop: 10,
  },
  
  // Cards
  cardCiclo: { 
    backgroundColor: COLORS.card, 
    padding: 20, 
    borderRadius: 20, 
    marginBottom: 15,
    marginHorizontal: 5,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardTreinoContainer: { 
    backgroundColor: COLORS.card, 
    padding: 15, 
    borderRadius: 12, 
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 10,
    marginHorizontal: 5,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cardExercicioContainer: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 15,
    marginHorizontal: 5,
    flexDirection: 'row',
    padding: 12,
  },
  cardContent: { flex: 1, marginLeft: 10, justifyContent: 'center' },
  
  // Textos
  tituloCiclo: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  textoData: { color: COLORS.textSecondary, fontSize: 13, marginTop: 2 },
  nomeEx: { color: COLORS.text, fontSize: 16, fontWeight: 'bold', marginLeft: 8, flexShrink: 1 },
  detalheEx: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2, marginLeft: 28 },
  textoFinalizado: { color: COLORS.textSecondary, fontSize: 12, fontWeight: 'bold', fontStyle: 'italic' },
  listaVaziaTexto: { color: COLORS.textSecondary, fontSize: 14, textAlign: 'center', marginTop: 20 },
  
  // Layout
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowInput: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  
  // Progresso
  containerProgresso: { height: 8, backgroundColor: COLORS.input, borderRadius: 4, marginTop: 10, overflow: 'hidden' },
  barraProgresso: { height: '100%', backgroundColor: COLORS.success },
  textoProgresso: { color: COLORS.textSecondary, fontSize: 12, fontWeight: 'bold', marginTop: 5 },
  
  // Checkbox (apenas para treinos)
  checkbox: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: COLORS.textSecondary, justifyContent: 'center', alignItems: 'center' },
  checkboxChecked: { backgroundColor: COLORS.success, borderColor: COLORS.success },
  statusContainer: { flexDirection: 'row', alignItems: 'center', gap: 10, marginLeft: 8 },
  
  // Botões de ação padronizados
  actionButtonsContainer: { flexDirection: 'row', gap: 8 },
  actionButtonsRow: { 
    flexDirection: 'row', 
    justifyContent: 'flex-end', 
    gap: 8, 
    marginTop: 10, 
    borderTopWidth: 1, 
    borderTopColor: COLORS.border, 
    paddingTop: 10,
    paddingHorizontal: 5,
    width: '100%',
  },
  actionButton: { 
    padding: 8, 
    backgroundColor: COLORS.input, 
    borderRadius: 8, 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 4,
    minWidth: 40,
    minHeight: 40,
    justifyContent: 'center'
  },
  actionButtonText: { 
    fontSize: 12, 
    fontWeight: '500',
    marginLeft: 2
  },
  
  // Exercício
  exerciseMainContent: {
    flex: 1,
    marginLeft: 10,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  exerciseTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  exerciseActions: {
    flexDirection: 'row',
    gap: 8,
  },
  exerciseSummary: {
    marginLeft: 28,
    marginTop: 2,
  },
  
  // Séries
  seriesContainer: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginLeft: 28,
  },
  seriesTitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  serieItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.input,
    padding: 8,
    borderRadius: 8,
    marginBottom: 6,
  },
  serieNumero: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: 'bold',
    width: 60,
  },
  serieInfo: {
    color: COLORS.textSecondary,
    fontSize: 12,
    flex: 1,
  },
  serieActions: {
    flexDirection: 'row',
    gap: 4,
  },
  serieActionBtn: {
    padding: 8,
  },
  adicionarSerieBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
    borderRadius: 8,
    marginTop: 8,
  },
  adicionarSerieText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '500',
  },
  
  // Botões individuais
  btnFlutuante: { 
    position: 'absolute', 
    right: 25, 
    bottom: 30,
    backgroundColor: COLORS.primaryStrong, 
    width: 60, 
    height: 60, 
    borderRadius: 30, 
    justifyContent: 'center', 
    alignItems: 'center', 
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  btnAdicionar: { 
    backgroundColor: COLORS.card, 
    padding: 15, 
    borderRadius: 12, 
    marginBottom: 15, 
    alignItems: 'center', 
    borderWidth: 1, 
    borderColor: COLORS.primary, 
    borderStyle: 'dashed',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 5,
  },
  textAdicionar: { color: COLORS.primary, fontWeight: 'bold', fontSize: 16 },
  btnTentarNovamente: {
    backgroundColor: COLORS.primaryStrong,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 20,
  },
  
  // Botões de reordenar
  reorderContainer: { 
    flexDirection: 'column', 
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.input,
    borderRadius: 8,
    padding: 4
  },
  btnArrow: { padding: 4 },
  
  // Modais
  modalCentrado: { 
    flex: 1, 
    backgroundColor: COLORS.overlay, 
    justifyContent: 'center',
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  modalView: { 
    backgroundColor: COLORS.card, 
    borderRadius: 25, 
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 25, 
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    width: '100%',
    maxWidth: 480,
  },
  modalTitulo: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center', color: COLORS.text },
  input: { backgroundColor: COLORS.input, color: COLORS.text, borderRadius: 12, padding: 15, marginBottom: 12, fontSize: 16 },
  btnData: { backgroundColor: COLORS.input, flex: 1, paddingVertical: 12, paddingHorizontal: 10, borderRadius: 12, alignItems: 'center' },
  rotuloData: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600' },
  btnDataTexto: { color: COLORS.text, fontSize: 15, marginTop: 4 },
  
  // Botões do modal
  modalButtonsContainer: { flexDirection: 'row', gap: 10, marginTop: 10 },
  modalButtonSalvar: { backgroundColor: COLORS.primaryStrong, flex: 1, padding: 16, borderRadius: 12, alignItems: 'center' },
  modalButtonCancelar: { backgroundColor: COLORS.input, flex: 1, padding: 16, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  modalButtonTexto: { color: COLORS.onPrimary, fontWeight: 'bold', fontSize: 16 },
  
  // Empty state
  emptyContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    paddingVertical: 50,
  },
  emptyText: { color: COLORS.textSecondary, fontSize: 18, fontWeight: 'bold', marginTop: 20, textAlign: 'center' },
  emptySubText: { color: COLORS.textSecondary, fontSize: 14, marginTop: 10, textAlign: 'center' }
});

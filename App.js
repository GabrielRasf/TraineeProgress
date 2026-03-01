import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, FlatList, TouchableOpacity,
  TextInput, Modal, Alert, SafeAreaView, KeyboardAvoidingView, Platform, StatusBar,
  ScrollView
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

const COLORS = {
  background: '#121212',
  card: '#1E1E1E',
  text: '#FFFFFF',
  textSecondary: '#A0A0A0',
  primary: '#3798FF',
  danger: '#FF5252',
  success: '#20c997',
  border: '#333333',
  input: '#2C2C2C',
  header: '#121212'
};

const STORAGE_KEY = '@meus_treinos_final_v9';

export default function App() {
  const [ciclos, setCiclos] = useState([]);
  const [modalCicloVisible, setModalCicloVisible] = useState(false);
  const [modalTreinoVisible, setModalTreinoVisible] = useState(false);
  const [modalExercicioVisible, setModalExercicioVisible] = useState(false);
  
  const [cicloSelecionado, setCicloSelecionado] = useState(null);
  const [treinoSelecionado, setTreinoSelecionado] = useState(null);

  // Estados dos inputs
  const [nomeCiclo, setNomeCiclo] = useState('');
  const [dataInicio, setDataInicio] = useState(new Date());
  const [dataFim, setDataFim] = useState(new Date());
  const [treinosPorSemana, setTreinosPorSemana] = useState(''); 
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState('inicio');
  const [nomeTreino, setNomeTreino] = useState('');
  const [nomeEx, setNomeEx] = useState('');
  const [seriesEx, setSeriesEx] = useState('');
  const [repsEx, setRepsEx] = useState('');
  const [tempoEx, setTempoEx] = useState('');
  const [velocidadeEx, setVelocidadeEx] = useState('');
  const [horarioEx, setHorarioEx] = useState('');
  const [idExSendoEditado, setIdExSendoEditado] = useState(null);
  
  const [idCicloSendoEditado, setIdCicloSendoEditado] = useState(null);
  const [idTreinoSendoEditado, setIdTreinoSendoEditado] = useState(null);

  useEffect(() => { carregarDados(); }, []);

  const carregarDados = async () => {
    try {
      const valor = await AsyncStorage.getItem(STORAGE_KEY);
      if (valor !== null) {
        setCiclos(JSON.parse(valor));
      } else {
        setCiclos([]);
      }
    } catch (e) { 
      Alert.alert("Erro", "Não foi possível carregar os dados."); 
      console.log(e);
    }
  };

  const salvarDados = async (novosCiclos) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(novosCiclos));
      setCiclos(novosCiclos);
    } catch (e) { console.log("Erro ao salvar", e); }
  };

  const formatarData = (data) => new Date(data).toLocaleDateString('pt-BR');
  const obterDataValida = (data) => (!data || isNaN(new Date(data).getTime())) ? new Date() : new Date(data);

  const calcularTotalTreinos = (inicio, fim, freq) => {
    const data1 = new Date(inicio);
    const data2 = new Date(fim);
    data1.setHours(0,0,0,0);
    data2.setHours(0,0,0,0);
    
    const diffTime = Math.abs(data2 - data1);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    const semanas = diffDays / 7;
    const totalTreinos = Math.ceil(semanas * freq);
    
    return Math.max(totalTreinos, 1);
  };

  const onDateChange = (event, selectedDate) => {
    const currentDate = selectedDate || (datePickerMode === 'inicio' ? dataInicio : dataFim);
    setShowDatePicker(Platform.OS === 'ios');
    if (datePickerMode === 'inicio') {
        const novaDataInicio = obterDataValida(currentDate);
        setDataInicio(novaDataInicio);
        if (novaDataInicio > dataFim) setDataFim(novaDataInicio);
    } else {
        setDataFim(obterDataValida(currentDate));
    }
  };

  const salvarCiclo = () => {
    const freqInt = parseInt(treinosPorSemana);
    if (!nomeCiclo.trim() || isNaN(freqInt) || freqInt <= 0 || freqInt > 7) {
        Alert.alert("Erro", "Preencha o nome e um número válido de treinos por semana (1 a 7).");
        return;
    }
    
    if (dataFim < dataInicio) {
      Alert.alert("Erro", "Data final não pode ser menor que a data inicial.");
      return;
    }
    
    const metaTotal = calcularTotalTreinos(dataInicio, dataFim, freqInt);
    
    if (idCicloSendoEditado) {
        const ciclosAtualizados = ciclos.map(c => {
            if (c.id === idCicloSendoEditado) {
                return {
                    ...c,
                    nome: nomeCiclo,
                    dataInicio: dataInicio.toISOString(),
                    dataFim: dataFim.toISOString(),
                    metaTotal: metaTotal,
                    frequenciaSemanal: freqInt,
                };
            }
            return c;
        });
        salvarDados(ciclosAtualizados);
    } else {
        const novoCiclo = {
            id: Date.now().toString(),
            nome: nomeCiclo,
            dataInicio: dataInicio.toISOString(),
            dataFim: dataFim.toISOString(),
            metaTotal: metaTotal,
            frequenciaSemanal: freqInt,
            treinos: [] 
        };
        salvarDados([...ciclos, novoCiclo]);
    }
    
    fecharModalCiclo();
  };

  const deletarCiclo = (id) => {
    Alert.alert("Excluir Ciclo", "Deseja remover este ciclo e todos os seus treinos?", [
        { text: "Cancelar", style: "cancel" },
        { text: "Excluir", onPress: () => salvarDados(ciclos.filter(c => c.id !== id)), style: "destructive" }
    ]);
  };

  const salvarTreino = () => {
    if (!nomeTreino.trim() || !cicloSelecionado) {
      Alert.alert("Erro", "Nome do treino é obrigatório");
      return;
    }
    
    let listaAtualizada;
    
    if (idTreinoSendoEditado) {
        // Editando treino existente
        const treinosAtualizados = cicloSelecionado.treinos.map(t => 
            t.id === idTreinoSendoEditado ? {...t, nome: nomeTreino} : t
        );
        const cicloAtualizado = { ...cicloSelecionado, treinos: treinosAtualizados };
        listaAtualizada = ciclos.map(c => c.id === cicloSelecionado.id ? cicloAtualizado : c);
        
        setCicloSelecionado(cicloAtualizado);
        
        // Se o treino sendo editado é o que está aberto, atualiza também
        if (treinoSelecionado && treinoSelecionado.id === idTreinoSendoEditado) {
          setTreinoSelecionado({...treinoSelecionado, nome: nomeTreino});
        }
    } else {
        // Adicionando novo treino - com contador de execuções
        const novoTreino = {
            id: Date.now().toString(),
            nome: nomeTreino,
            dataCriacao: new Date().toISOString(),
            // Mudamos de 'finalizado' para um array de datas
            datasExecucao: [], // Array para armazenar as datas que o treino foi feito
            exercicios: []
        };
        const cicloAtualizado = { ...cicloSelecionado, treinos: [...cicloSelecionado.treinos, novoTreino] };
        listaAtualizada = ciclos.map(c => c.id === cicloSelecionado.id ? cicloAtualizado : c);
        
        setCicloSelecionado(cicloAtualizado);
    }

    salvarDados(listaAtualizada);
    fecharModalTreino();
  };

  const deletarTreino = (treinoId) => {
    Alert.alert("Excluir Treino", "Deseja remover este treino e todos os seus exercícios?", [
        { text: "Cancelar", style: "cancel" },
        { text: "Excluir", onPress: () => {
            const treinosAtualizados = cicloSelecionado.treinos.filter(t => t.id !== treinoId);
            const cicloAtualizado = { ...cicloSelecionado, treinos: treinosAtualizados };
            const listaAtualizada = ciclos.map(c => c.id === cicloSelecionado.id ? cicloAtualizado : c);
            
            salvarDados(listaAtualizada);
            setCicloSelecionado(cicloAtualizado);
            
            // Se o treino deletado é o que está aberto, fecha o modal
            if (treinoSelecionado && treinoSelecionado.id === treinoId) {
              setTreinoSelecionado(null);
            }
        }, style: "destructive" }
    ]);
  };

  const copiarTreino = (treinoParaCopiar) => {
    const novoTreino = {
        ...treinoParaCopiar,
        id: Date.now().toString(),
        nome: `${treinoParaCopiar.nome} (Cópia)`,
        datasExecucao: [], // Começa sem execuções
        dataCriacao: new Date().toISOString()
    };
    const cicloAtualizado = { ...cicloSelecionado, treinos: [...cicloSelecionado.treinos, novoTreino] };
    const listaAtualizada = ciclos.map(c => c.id === cicloSelecionado.id ? cicloAtualizado : c);
    
    salvarDados(listaAtualizada);
    setCicloSelecionado(cicloAtualizado);
  };

  // Função para verificar se o treino já foi feito hoje
  const foiFeitoHoje = (treino) => {
    if (!treino.datasExecucao || treino.datasExecucao.length === 0) return false;
    
    const hoje = new Date().toDateString();
    return treino.datasExecucao.some(data => new Date(data).toDateString() === hoje);
  };

  // Função para contar quantas vezes o treino foi feito no total
  const contarExecucoes = (treino) => {
    return treino.datasExecucao ? treino.datasExecucao.length : 0;
  };

  // Função atualizada para marcar/desmarcar treino
  const alternarExecucaoTreino = (treinoId) => {
    const hoje = new Date().toISOString();
    
    const treinosAtualizados = cicloSelecionado.treinos.map(t => {
      if (t.id === treinoId) {
        const jaFoiHoje = foiFeitoHoje(t);
        
        if (jaFoiHoje) {
          // Remove a execução de hoje
          return {
            ...t,
            datasExecucao: t.datasExecucao.filter(data => 
              new Date(data).toDateString() !== new Date().toDateString()
            )
          };
        } else {
          // Adiciona nova execução
          return {
            ...t,
            datasExecucao: [...(t.datasExecucao || []), hoje]
          };
        }
      }
      return t;
    });

    const cicloAtualizado = { ...cicloSelecionado, treinos: treinosAtualizados };
    const listaAtualizada = ciclos.map(c => c.id === cicloSelecionado.id ? cicloAtualizado : c);
    
    salvarDados(listaAtualizada);
    setCicloSelecionado(cicloAtualizado);
    
    // Atualiza treinoSelecionado se ele estiver aberto
    if (treinoSelecionado && treinoSelecionado.id === treinoId) {
      const treinoAtualizado = treinosAtualizados.find(t => t.id === treinoId);
      setTreinoSelecionado(treinoAtualizado);
    }
  };

  const salvarExercicio = () => {
    if (!nomeEx.trim()) {
      Alert.alert("Erro", "Nome do exercício é obrigatório");
      return;
    }
    
    if (!treinoSelecionado) return;
    
    const exData = {
      id: idExSendoEditado || Date.now().toString(),
      nome: nomeEx,
      series: seriesEx,
      reps: repsEx,
      tempo: tempoEx,
      velocidade: velocidadeEx,
      horario: horarioEx
    };
    
    let novoTreinoSelecionado = {...treinoSelecionado};

    if (idExSendoEditado) {
      novoTreinoSelecionado.exercicios = treinoSelecionado.exercicios.map(ex => ex.id === idExSendoEditado ? exData : ex);
    } else {
      novoTreinoSelecionado.exercicios = [...treinoSelecionado.exercicios, exData];
    }

    const treinosAtualizados = cicloSelecionado.treinos.map(t => {
      if(t.id === novoTreinoSelecionado.id) return novoTreinoSelecionado;
      return t;
    });

    const cicloAtualizado = { ...cicloSelecionado, treinos: treinosAtualizados };
    const listaAtualizada = ciclos.map(c => c.id === cicloSelecionado.id ? cicloAtualizado : c);
    
    salvarDados(listaAtualizada);
    setCicloSelecionado(cicloAtualizado);
    setTreinoSelecionado(novoTreinoSelecionado);
    fecharModalExercicio();
  };

  const moverExercicio = (index, direcao) => {
    const novosExercicios = [...treinoSelecionado.exercicios];
    const novoIndex = direcao === 'up' ? index - 1 : index + 1;
    if (novoIndex < 0 || novoIndex >= novosExercicios.length) return;
    [novosExercicios[index], novosExercicios[novoIndex]] = [novosExercicios[novoIndex], novosExercicios[index]];
    atualizarTreinoNoStorage(novosExercicios);
  };

  const atualizarTreinoNoStorage = (novaListaExercicios) => {
    const novoTreinoSelecionado = {...treinoSelecionado, exercicios: novaListaExercicios};
    const treinosAtualizados = cicloSelecionado.treinos.map(t => {
        if(t.id === novoTreinoSelecionado.id) return novoTreinoSelecionado;
        return t;
    });
    const cicloAtualizado = { ...cicloSelecionado, treinos: treinosAtualizados };
    const listaAtualizada = ciclos.map(c => c.id === cicloSelecionado.id ? cicloAtualizado : c);
    
    salvarDados(listaAtualizada);
    setCicloSelecionado(cicloAtualizado);
    setTreinoSelecionado(novoTreinoSelecionado);
  };

  const deletarExercicio = (exId) => {
    Alert.alert("Excluir Exercício", "Remover este exercício?", [
        { text: "Cancelar", style: "cancel" },
        { text: "Excluir", onPress: () => {
            const exerciciosAtualizados = treinoSelecionado.exercicios.filter(ex => ex.id !== exId);
            atualizarTreinoNoStorage(exerciciosAtualizados);
        }, style: "destructive" }
    ]);
  };

  const fecharModalCiclo = () => { 
    setNomeCiclo(''); 
    setDataInicio(new Date()); 
    setDataFim(new Date()); 
    setTreinosPorSemana(''); 
    setIdCicloSendoEditado(null); 
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
    setIdExSendoEditado(null); 
    setModalExercicioVisible(false); 
  };

  const formatarDetalhesExercicio = (item) => {
    const partes = [];
    if (item.horario && item.horario.trim() !== '') partes.push(`🕒 ${item.horario.trim()}`);
    if ((item.series && item.series.trim() !== '') && (item.reps && item.reps.trim() !== '')) {
        partes.push(`${item.series.trim()} x ${item.reps.trim()}`);
    } else if (item.series && item.series.trim() !== '') {
        partes.push(`${item.series.trim()}`);
    } else if (item.reps && item.reps.trim() !== '') {
        partes.push(`${item.reps.trim()}`);
    }
    if (item.tempo && item.tempo.trim() !== '') partes.push(`${item.tempo.trim()}`);
    if (item.velocidade && item.velocidade.trim() !== '') partes.push(`${item.velocidade.trim()}`);
    return partes.join(' | ');
  };

  // Componente de botão de ação padronizado
  const ActionButton = ({ icon, color, onPress, label }) => (
    <TouchableOpacity style={styles.actionButton} onPress={onPress}>
      <Ionicons name={icon} size={18} color={color} />
      {label && <Text style={[styles.actionButtonText, { color }]}>{label}</Text>}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <Text style={styles.header}>Meus Ciclos</Text>
      <FlatList
        data={ciclos}
        keyExtractor={item => item.id}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Ionicons name="fitness-outline" size={60} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>Nenhum ciclo criado ainda</Text>
            <Text style={styles.emptySubText}>Toque no botão + para começar</Text>
          </View>
        )}
        renderItem={({ item }) => {
          const listaTreinos = item.treinos || [];
          // Soma todas as execuções de todos os treinos
          const totalExecucoes = listaTreinos.reduce((acc, treino) => 
            acc + (treino.datasExecucao ? treino.datasExecucao.length : 0), 0
          );
          const metaTotal = item.metaTotal || 1;
          const progresso = metaTotal > 0 ? (totalExecucoes / metaTotal) * 100 : 0;
          
          return (
            <View style={styles.cardCiclo}>
              <TouchableOpacity onPress={() => setCicloSelecionado(item)} style={{flex: 1}}>
                <View style={styles.row}>
                  <View style={{flex: 1}}>
                    <Text style={styles.tituloCiclo}>{item.nome}</Text>
                    <Text style={styles.textoData}>{formatarData(item.dataInicio)} - {formatarData(item.dataFim)}</Text>
                  </View>
                  <View style={styles.actionButtonsContainer}>
                    <ActionButton
                      icon="pencil-outline"
                      color={COLORS.primary}
                      onPress={() => {
                        setIdCicloSendoEditado(item.id);
                        setNomeCiclo(item.nome);
                        setDataInicio(new Date(item.dataInicio));
                        setDataFim(new Date(item.dataFim));
                        setTreinosPorSemana(item.frequenciaSemanal.toString());
                        setModalCicloVisible(true);
                      }}
                    />
                    <ActionButton
                      icon="trash-outline"
                      color={COLORS.danger}
                      onPress={() => deletarCiclo(item.id)}
                    />
                  </View>
                </View>
                <View style={styles.containerProgresso}>
                  <View style={[styles.barraProgresso, { width: `${Math.min(progresso, 100)}%` }]} />
                </View>
                <Text style={styles.textoProgresso}>{totalExecucoes} / {metaTotal} treinos realizados ({item.frequenciaSemanal}x/sem)</Text>
              </TouchableOpacity>
            </View>
          );
        }}
      />
      <TouchableOpacity style={styles.btnFlutuante} onPress={() => setModalCicloVisible(true)}>
        <Ionicons name="add" size={32} color="white" />
      </TouchableOpacity>

      {/* MODAL DETALHE DO CICLO (LISTA DE TREINOS) */}
      <Modal visible={!!cicloSelecionado} animationType="slide">
        <SafeAreaView style={styles.container}>
          <View style={styles.headerDetalhe}>
            <TouchableOpacity onPress={() => setCicloSelecionado(null)}>
              <Ionicons name="arrow-back" size={28} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={styles.headerMenor}>{cicloSelecionado?.nome}</Text>
            <View style={{width: 28}} />
          </View>
          <FlatList
            data={cicloSelecionado?.treinos || []}
            keyExtractor={item => item.id}
            ListHeaderComponent={() => (
                <View>
                    <Text style={styles.subHeaderDetalhe}>
                      {formatarData(cicloSelecionado?.dataInicio)} até {formatarData(cicloSelecionado?.dataFim)}
                    </Text>
                    <TouchableOpacity 
                      style={styles.btnAdicionar} 
                      onPress={() => {
                        setNomeTreino('');
                        setIdTreinoSendoEditado(null);
                        setModalTreinoVisible(true);
                      }}>
                      <Ionicons name="add-circle-outline" size={24} color={COLORS.primary} />
                      <Text style={styles.textAdicionar}>Adicionar Treino</Text>
                    </TouchableOpacity>
                </View>
            )}
            renderItem={({ item }) => {
              const foiHoje = foiFeitoHoje(item);
              const totalExecucoes = contarExecucoes(item);
              
              return (
                <View style={styles.cardTreinoContainer}>
                  <TouchableOpacity 
                    style={styles.cardContent} 
                    onPress={() => setTreinoSelecionado(item)}>
                    <View style={{flex: 1}}>
                      <View style={styles.row}>
                        <View style={{flex: 1}}>
                          <Text style={styles.nomeEx}>{item.nome}</Text>
                          <Text style={styles.detalheEx}>
                            {item.exercicios.length} Exercícios • {totalExecucoes}x realizado
                          </Text>
                        </View>
                        <View style={styles.statusContainer}>
                          <Text style={[styles.textoFinalizado, foiHoje && {color: COLORS.success}]}>
                            {foiHoje ? "Feito hoje" : "Pendente"}
                          </Text>
                          <TouchableOpacity 
                            style={[styles.checkbox, foiHoje && styles.checkboxChecked]} 
                            onPress={() => alternarExecucaoTreino(item.id)}>
                              {foiHoje && <Ionicons name="checkmark" size={20} color="white" />}
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>

                  {/* Botões de ação do treino */}
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
      <Modal visible={!!treinoSelecionado} animationType="slide">
        <SafeAreaView style={styles.container}>
          <View style={styles.headerDetalhe}>
            <TouchableOpacity onPress={() => setTreinoSelecionado(null)}>
              <Ionicons name="arrow-back" size={28} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={styles.headerMenor}>{treinoSelecionado?.nome}</Text>
            <View style={{width: 28}} />
          </View>
          
          <FlatList
            data={treinoSelecionado?.exercicios || []}
            keyExtractor={item => item.id}
            ListHeaderComponent={() => (
              <TouchableOpacity 
                style={styles.btnAdicionar} 
                onPress={() => {
                  setNomeEx('');
                  setSeriesEx('');
                  setRepsEx('');
                  setTempoEx('');
                  setVelocidadeEx('');
                  setHorarioEx('');
                  setIdExSendoEditado(null);
                  setModalExercicioVisible(true);
                }}>
                <Ionicons name="add-circle-outline" size={24} color={COLORS.primary} />
                <Text style={styles.textAdicionar}>Adicionar Exercício</Text>
              </TouchableOpacity>
            )}
            renderItem={({ item, index }) => (
              <View style={styles.cardExercicioDetalhado}>
                <View style={styles.reorderContainer}>
                  <TouchableOpacity 
                    onPress={() => moverExercicio(index, 'up')} 
                    style={[styles.btnArrow, index === 0 && {opacity: 0.3}]} 
                    disabled={index === 0}>
                      <Ionicons name="chevron-up" size={20} color={COLORS.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={() => moverExercicio(index, 'down')} 
                    style={[styles.btnArrow, index === (treinoSelecionado.exercicios.length - 1) && {opacity: 0.3}]} 
                    disabled={index === (treinoSelecionado.exercicios.length - 1)}>
                      <Ionicons name="chevron-down" size={20} color={COLORS.primary} />
                  </TouchableOpacity>
                </View>
                
                <View style={styles.exerciseContent}>
                  <Text style={styles.nomeEx}>{item.nome}</Text>
                  <Text style={styles.detalheEx}>{formatarDetalhesExercicio(item)}</Text>
                </View>

                <View style={styles.actionButtonsVertical}>
                  <ActionButton
                    icon="pencil-outline"
                    color={COLORS.primary}
                    onPress={() => {
                      setIdExSendoEditado(item.id);
                      setNomeEx(item.nome);
                      setSeriesEx(item.series);
                      setRepsEx(item.reps);
                      setTempoEx(item.tempo);
                      setVelocidadeEx(item.velocidade);
                      setHorarioEx(item.horario || '');
                      setModalExercicioVisible(true);
                    }}
                  />
                  <ActionButton
                    icon="trash-outline"
                    color={COLORS.danger}
                    onPress={() => deletarExercicio(item.id)}
                  />
                </View>
              </View>
            )}
          />
        </SafeAreaView>
      </Modal>

      {/* MODAIS DE FORMULÁRIO (mantidos iguais) */}
      <Modal visible={modalCicloVisible} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalCentrado}>
          <ScrollView contentContainerStyle={{flexGrow: 1, justifyContent: 'center'}}>
            <View style={styles.modalView}>
              <Text style={styles.modalTitulo}>{idCicloSendoEditado ? "Editar Ciclo" : "Novo Ciclo"}</Text>
              <TextInput 
                style={styles.input} 
                placeholder="Nome (ex: Foco Hipertrofia)" 
                placeholderTextColor={COLORS.textSecondary} 
                value={nomeCiclo} 
                onChangeText={setNomeCiclo} 
              />
              <View style={styles.rowInput}>
                <TouchableOpacity style={styles.btnData} onPress={() => { setDatePickerMode('inicio'); setShowDatePicker(true); }}>
                  <Text style={styles.btnDataTexto}>Início: {formatarData(dataInicio)}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnData} onPress={() => { setDatePickerMode('fim'); setShowDatePicker(true); }}>
                  <Text style={styles.btnDataTexto}>Fim: {formatarData(dataFim)}</Text>
                </TouchableOpacity>
              </View>
              
              <TextInput 
                style={styles.input} 
                placeholder="Treinos por semana (ex: 4)" 
                placeholderTextColor={COLORS.textSecondary} 
                value={treinosPorSemana} 
                onChangeText={setTreinosPorSemana} 
                keyboardType="numeric" 
              />
              
              {showDatePicker && (
                <DateTimePicker 
                  value={datePickerMode === 'inicio' ? dataInicio : dataFim} 
                  mode="date" 
                  display="default" 
                  onChange={onDateChange} 
                  themeVariant="dark" 
                />
              )}
              <View style={styles.modalButtonsContainer}>
                <TouchableOpacity style={styles.modalButtonSalvar} onPress={salvarCiclo}>
                  <Text style={styles.modalButtonTexto}>Salvar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalButtonCancelar} onPress={fecharModalCiclo}>
                  <Text style={styles.modalButtonTexto}>Cancelar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={modalTreinoVisible} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalCentrado}>
          <View style={styles.modalView}>
            <Text style={styles.modalTitulo}>{idTreinoSendoEditado ? "Editar Treino" : "Novo Treino"}</Text>
            <TextInput 
              style={styles.input} 
              placeholder="Nome (ex: Treino A)" 
              placeholderTextColor={COLORS.textSecondary} 
              value={nomeTreino} 
              onChangeText={setNomeTreino} 
            />
            <View style={styles.modalButtonsContainer}>
              <TouchableOpacity style={styles.modalButtonSalvar} onPress={salvarTreino}>
                <Text style={styles.modalButtonTexto}>Salvar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalButtonCancelar} onPress={fecharModalTreino}>
                <Text style={styles.modalButtonTexto}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={modalExercicioVisible} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalCentrado}>
          <ScrollView contentContainerStyle={{flexGrow: 1, justifyContent: 'center'}}>
            <View style={styles.modalView}>
              <Text style={styles.modalTitulo}>{idExSendoEditado ? "Editar" : "Novo"} Exercício</Text>
              <TextInput 
                style={styles.input} 
                placeholder="Nome (ex: Supino)" 
                placeholderTextColor={COLORS.textSecondary} 
                value={nomeEx} 
                onChangeText={setNomeEx} 
              />
              <TextInput 
                style={styles.input} 
                placeholder="Horário (ex: 19:00)" 
                placeholderTextColor={COLORS.textSecondary} 
                value={horarioEx} 
                onChangeText={setHorarioEx} 
              />
              
              <View style={styles.rowInput}>
                <TextInput 
                  style={[styles.input, {flex: 1}]} 
                  placeholder="Séries" 
                  placeholderTextColor={COLORS.textSecondary} 
                  value={seriesEx} 
                  onChangeText={setSeriesEx} 
                  keyboardType="numeric" 
                />
                <TextInput 
                  style={[styles.input, {flex: 1}]} 
                  placeholder="Reps" 
                  placeholderTextColor={COLORS.textSecondary} 
                  value={repsEx} 
                  onChangeText={setRepsEx} 
                  keyboardType="numeric" 
                />
              </View>

              <View style={styles.rowInput}>
                <TextInput 
                  style={[styles.input, {flex: 1}]} 
                  placeholder="Tempo (ex: 60s)" 
                  placeholderTextColor={COLORS.textSecondary} 
                  value={tempoEx} 
                  onChangeText={setTempoEx} 
                />
                <TextInput 
                  style={[styles.input, {flex: 1}]} 
                  placeholder="Velocidade (ex: 2010)" 
                  placeholderTextColor={COLORS.textSecondary} 
                  value={velocidadeEx} 
                  onChangeText={setVelocidadeEx} 
                />
              </View>

              <View style={styles.modalButtonsContainer}>
                <TouchableOpacity style={styles.modalButtonSalvar} onPress={salvarExercicio}>
                  <Text style={styles.modalButtonTexto}>Salvar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalButtonCancelar} onPress={fecharModalExercicio}>
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
  container: { flex: 1, backgroundColor: COLORS.background, paddingHorizontal: 20 },
  header: { fontSize: 32, fontWeight: 'bold', color: COLORS.text, marginTop: 50, marginBottom: 20 },
  headerDetalhe: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, marginTop: 10 },
  headerMenor: { fontSize: 24, fontWeight: 'bold', color: COLORS.text, flex: 1, textAlign: 'center' },
  subHeaderDetalhe: { color: COLORS.textSecondary, fontSize: 14, marginBottom: 20, textAlign: 'center' },
  
  // Cards
  cardCiclo: { backgroundColor: COLORS.card, padding: 20, borderRadius: 20, marginBottom: 15 },
  cardTreinoContainer: { backgroundColor: COLORS.card, padding: 15, borderRadius: 12, marginBottom: 10 },
  cardExercicioDetalhado: { 
    backgroundColor: COLORS.card, 
    padding: 15, 
    borderRadius: 12, 
    marginBottom: 10, 
    flexDirection: 'row', 
    alignItems: 'center',
    minHeight: 70
  },
  cardContent: { flex: 1 },
  
  // Textos
  tituloCiclo: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  textoData: { color: COLORS.textSecondary, fontSize: 13, marginTop: 2 },
  nomeEx: { color: COLORS.text, fontSize: 16, fontWeight: 'bold' },
  detalheEx: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },
  textoFinalizado: { color: COLORS.textSecondary, fontSize: 12, fontWeight: 'bold', fontStyle: 'italic' },
  
  // Layout
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowInput: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  
  // Progresso
  containerProgresso: { height: 8, backgroundColor: COLORS.input, borderRadius: 4, marginTop: 10, overflow: 'hidden' },
  barraProgresso: { height: '100%', backgroundColor: COLORS.success },
  textoProgresso: { color: COLORS.textSecondary, fontSize: 12, fontWeight: 'bold', marginTop: 5 },
  
  // Checkbox
  checkbox: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: COLORS.textSecondary, justifyContent: 'center', alignItems: 'center' },
  checkboxChecked: { backgroundColor: COLORS.success, borderColor: COLORS.success },
  statusContainer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  
  // Botões de ação padronizados
  actionButtonsContainer: { flexDirection: 'row', gap: 8 },
  actionButtonsRow: { 
    flexDirection: 'row', 
    justifyContent: 'flex-end', 
    gap: 8, 
    marginTop: 10, 
    borderTopWidth: 1, 
    borderTopColor: COLORS.border, 
    paddingTop: 10 
  },
  actionButtonsVertical: { 
    flexDirection: 'column', 
    gap: 8,
    marginLeft: 10
  },
  actionButton: { 
    padding: 8, 
    backgroundColor: COLORS.input, 
    borderRadius: 8, 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 4,
    minWidth: 40,
    justifyContent: 'center'
  },
  actionButtonText: { 
    fontSize: 12, 
    fontWeight: '500',
    marginLeft: 2
  },
  
  // Botões individuais
  btnFlutuante: { 
    position: 'absolute', 
    right: 25, 
    bottom: 25, 
    backgroundColor: COLORS.primary, 
    width: 60, 
    height: 60, 
    borderRadius: 30, 
    justifyContent: 'center', 
    alignItems: 'center', 
    elevation: 8 
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
    gap: 8
  },
  textAdicionar: { color: COLORS.primary, fontWeight: 'bold', fontSize: 16 },
  
  // Botões de reordenar
  reorderContainer: { 
    flexDirection: 'column', 
    marginRight: 10,
    alignItems: 'center',
    backgroundColor: COLORS.input,
    borderRadius: 8,
    padding: 4
  },
  btnArrow: { padding: 4 },
  
  // Conteúdo do exercício
  exerciseContent: { flex: 1 },
  
  // Modais
  modalCentrado: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center' },
  modalView: { 
    width: '90%', 
    backgroundColor: COLORS.card, 
    borderRadius: 25, 
    padding: 25, 
    alignSelf: 'center',
    maxHeight: '80%'
  },
  modalTitulo: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center', color: COLORS.text },
  input: { backgroundColor: COLORS.input, color: COLORS.text, borderRadius: 12, padding: 15, marginBottom: 12, fontSize: 16 },
  btnData: { backgroundColor: COLORS.input, flex: 1, padding: 15, borderRadius: 12, alignItems: 'center' },
  btnDataTexto: { color: COLORS.text, fontSize: 14 },
  
  // Botões do modal
  modalButtonsContainer: { flexDirection: 'row', gap: 10, marginTop: 10 },
  modalButtonSalvar: { backgroundColor: COLORS.primary, flex: 1, padding: 16, borderRadius: 12, alignItems: 'center' },
  modalButtonCancelar: { backgroundColor: COLORS.input, flex: 1, padding: 16, borderRadius: 12, alignItems: 'center' },
  modalButtonTexto: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  
  // Empty state
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 50 },
  emptyText: { color: COLORS.textSecondary, fontSize: 18, fontWeight: 'bold', marginTop: 20 },
  emptySubText: { color: COLORS.textSecondary, fontSize: 14, marginTop: 10, textAlign: 'center' }
});
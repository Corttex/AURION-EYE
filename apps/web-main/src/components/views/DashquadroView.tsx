'use client';

import React, { useState } from 'react';
import { Bell, Plus, RefreshCw, Search, X } from 'lucide-react';
import type { AgentTask, TaskStatus } from '@aurion/shared-protocol';
import { vpsFetch } from '@/lib/aurionApi';
import { useAurionStore } from '@/store/useAurionStore';

const COLUMNS: Array<{
  status: TaskStatus;
  title: string;
  subtitle: string;
  topBorder: string;
  dotColor: string;
}> = [
  { status: 'TRIAGE', title: 'Triagem', subtitle: 'Ideias brutas — aguardando especificações', topBorder: 'border-t-aurion-purple', dotColor: 'bg-aurion-purple' },
  { status: 'TODO', title: 'A Fazer', subtitle: 'Aguardando dependências ou sem responsável', topBorder: 'border-t-aurion-blue', dotColor: 'bg-aurion-blue' },
  { status: 'SCHEDULED', title: 'Agendado', subtitle: 'Aguardando tempo determinado / gatilho Cron', topBorder: 'border-t-aurion-indigo', dotColor: 'bg-aurion-indigo' },
  { status: 'READY', title: 'Pronto', subtitle: 'Dependências concluídas; pronto para execução', topBorder: 'border-t-aurion-gold', dotColor: 'bg-aurion-gold' },
  { status: 'IN_PROGRESS', title: 'Em Andamento', subtitle: 'Assumido por um agente; em execução', topBorder: 'border-t-aurion-lime', dotColor: 'bg-aurion-lime' },
];

export const DashquadroView: React.FC = () => {
  const { tasks, refreshAll } = useAurionStore();
  const [board, setBoard] = useState('Aurion - Geral');
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('ALL');
  const [agentFilter, setAgentFilter] = useState('ALL');
  const [selectedTask, setSelectedTask] = useState<AgentTask | null>(null);
  const [newTaskModal, setNewTaskModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newProject, setNewProject] = useState('Aurion');
  const [newAgent, setNewAgent] = useState('@orquestrador');

  const filtered = tasks.filter((t) => {
    if (t.status === 'DONE') return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (projectFilter !== 'ALL' && t.project !== projectFilter) return false;
    if (agentFilter !== 'ALL' && t.assigned_agent !== agentFilter) return false;
    return true;
  });

  const handleDropToColumn = async (taskId: string, targetStatus: TaskStatus) => {
    await vpsFetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: targetStatus }),
    });
    await refreshAll();
  };

  const handleNotifyAgents = async () => {
    await vpsFetch('/api/tasks/notify-agents', { method: 'POST' });
    await refreshAll();
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    await vpsFetch('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({
        title: newTitle.trim(),
        project: newProject,
        assigned_agent: newAgent,
        board,
        status: 'TRIAGE',
      }),
    });
    setNewTitle('');
    setNewTaskModal(false);
    await refreshAll();
  };

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Sub-header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-bold tracking-wider text-zinc-400">QUADRO:</span>
          <select
            value={board}
            onChange={(e) => setBoard(e.target.value)}
            className="bg-obsidian-850 border border-obsidian-border rounded-lg px-3 py-1.5 text-xs font-semibold text-zinc-100"
          >
            <option>Aurion - Geral</option>
            <option>Projetos SaaS</option>
            <option>Automações Clientes</option>
          </select>
          <span className="px-2 py-0.5 rounded-full bg-obsidian-800 border border-obsidian-border text-[11px] font-mono text-aurion-lime">
            {filtered.length} tarefas
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setNewTaskModal(true)}
            className="px-3 py-1.5 rounded-lg bg-obsidian-850 border border-obsidian-border hover:border-aurion-gold text-xs font-semibold flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> + NEW BOARD / TASK
          </button>
          <button
            type="button"
            onClick={handleNotifyAgents}
            className="px-3.5 py-1.5 rounded-lg bg-aurion-lime text-obsidian-950 text-xs font-bold flex items-center gap-1.5 hover:brightness-110 shadow-[0_0_16px_rgba(184,255,44,0.25)]"
          >
            <Bell className="w-3.5 h-3.5" /> NOTIFICAR AGENTES
          </button>
          <button
            type="button"
            onClick={() => refreshAll()}
            className="px-3 py-1.5 rounded-lg bg-obsidian-850 border border-obsidian-border text-xs text-zinc-300 flex items-center gap-1.5 hover:border-zinc-500"
          >
            <RefreshCw className="w-3.5 h-3.5" /> ATUALIZAR
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-2.5" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrar tarefas..."
            className="w-full bg-obsidian-850 border border-obsidian-border rounded-lg pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-aurion-gold"
          />
        </div>
        <select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="bg-obsidian-850 border border-obsidian-border rounded-lg px-3 py-1.5 text-xs"
        >
          <option value="ALL">CLIENTE / PROJETO: Todos os projetos</option>
          <option value="Aurion">Aurion</option>
          <option value="MedCore">MedCore</option>
          <option value="P2W">P2W</option>
          <option value="Sinal Sign">Sinal Sign</option>
        </select>
        <select
          value={agentFilter}
          onChange={(e) => setAgentFilter(e.target.value)}
          className="bg-obsidian-850 border border-obsidian-border rounded-lg px-3 py-1.5 text-xs"
        >
          <option value="ALL">RESPONSÁVEL: Todos os agentes</option>
          <option value="@orquestrador">@orquestrador</option>
          <option value="@dev">@dev</option>
          <option value="@rpa_worker">@rpa_worker</option>
          <option value="@arquiteto">@arquiteto</option>
          <option value="@copywriter">@copywriter</option>
        </select>
      </div>

      {/* 5-Column Drag-and-Drop Kanban */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 flex-1 min-h-[420px]">
        {COLUMNS.map((col) => {
          const colTasks = filtered.filter((t) => t.status === col.status);
          return (
            <div
              key={col.status}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                const taskId = e.dataTransfer.getData('text/plain');
                if (taskId) handleDropToColumn(taskId, col.status);
              }}
              className={`rounded-xl bg-obsidian-900 border border-obsidian-border border-t-2 ${col.topBorder} flex flex-col overflow-hidden`}
            >
              <div className="p-3 border-b border-obsidian-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${col.dotColor}`} />
                    <span className="text-xs font-bold text-zinc-100">{col.title}</span>
                  </div>
                  <span className="text-[11px] font-mono text-zinc-400">{colTasks.length}</span>
                </div>
                <p className="text-[10px] text-zinc-500 mt-1 line-clamp-1">{col.subtitle}</p>
              </div>

              <div className="flex-1 p-2.5 space-y-2.5 overflow-y-auto">
                {colTasks.map((task) => {
                  const doneCount = task.subtasks.filter((s) => s.done).length;
                  return (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData('text/plain', task.id)}
                      onClick={() => setSelectedTask(task)}
                      className="p-3 rounded-xl bg-obsidian-850 border border-obsidian-border hover:border-aurion-gold/70 cursor-pointer transition-colors space-y-2"
                    >
                      <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500">
                        <span>{task.id}</span>
                        <span>
                          {doneCount}/{task.subtasks.length}
                        </span>
                      </div>
                      <h3 className="text-xs font-medium text-zinc-100 leading-snug line-clamp-3">
                        {task.title}
                      </h3>
                      <div className="flex items-center justify-between pt-1">
                        <span className="px-1.5 py-0.5 rounded bg-obsidian-800 border border-obsidian-border text-[10px] font-mono text-aurion-lime">
                          {task.assigned_agent}
                        </span>
                        <span className="text-[10px] text-zinc-500">{task.project}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Task Modal */}
      {newTaskModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateTask}
            className="w-full max-w-md rounded-2xl bg-obsidian-900 border border-aurion-gold/50 p-5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-aurion-gold">Nova Tarefa no Dashquadro</h2>
              <button type="button" onClick={() => setNewTaskModal(false)}>
                <X className="w-4 h-4 text-zinc-400" />
              </button>
            </div>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Título objetivo da tarefa..."
              className="w-full bg-obsidian-950 border border-obsidian-border rounded-lg px-3 py-2 text-xs"
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={newProject}
                onChange={(e) => setNewProject(e.target.value)}
                className="bg-obsidian-950 border border-obsidian-border rounded-lg px-2.5 py-2 text-xs"
              >
                <option>Aurion</option>
                <option>MedCore</option>
                <option>P2W</option>
                <option>Sinal Sign</option>
              </select>
              <select
                value={newAgent}
                onChange={(e) => setNewAgent(e.target.value)}
                className="bg-obsidian-950 border border-obsidian-border rounded-lg px-2.5 py-2 text-xs"
              >
                <option>@orquestrador</option>
                <option>@dev</option>
                <option>@rpa_worker</option>
                <option>@arquiteto</option>
                <option>@copywriter</option>
              </select>
            </div>
            <button
              type="submit"
              className="w-full py-2 rounded-lg bg-aurion-lime text-obsidian-950 font-bold text-xs"
            >
              Criar na Triagem
            </button>
          </form>
        </div>
      )}

      {/* Slide-Over Task Drawer */}
      {selectedTask && (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-end">
          <div className="w-full max-w-md bg-obsidian-900 border-l border-obsidian-border h-full p-5 flex flex-col gap-4 overflow-y-auto">
            <div className="flex items-center justify-between border-b border-obsidian-border pb-3">
              <div>
                <span className="text-[11px] font-mono text-aurion-gold">{selectedTask.id}</span>
                <h2 className="text-sm font-bold text-zinc-100 mt-0.5">{selectedTask.title}</h2>
              </div>
              <button type="button" onClick={() => setSelectedTask(null)}>
                <X className="w-5 h-5 text-zinc-400 hover:text-zinc-100" />
              </button>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">{selectedTask.description || 'Sem descrição adicional.'}</p>

            <div>
              <h3 className="text-[11px] uppercase tracking-wider text-zinc-400 mb-2">Subtarefas</h3>
              <div className="space-y-1.5">
                {selectedTask.subtasks.map((s) => (
                  <div key={s.id} className="p-2 rounded-lg bg-obsidian-950 border border-obsidian-border text-xs flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${s.done ? 'bg-aurion-lime' : 'bg-zinc-600'}`} />
                    <span className={s.done ? 'line-through text-zinc-500' : 'text-zinc-200'}>{s.title}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-[11px] uppercase tracking-wider text-zinc-400 mb-2">Log do Túnel / Output</h3>
              <pre className="p-3 rounded-xl bg-obsidian-950 border border-obsidian-border text-[11px] font-mono text-aurion-lime whitespace-pre-wrap">
                {selectedTask.output_log || 'Aguardando execução de worker.'}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

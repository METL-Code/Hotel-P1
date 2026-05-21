import React, { useState } from 'react';

interface Task {
  id: number;
  title: string;
  due: string;
  detail: string;
  priority: 'Alta' | 'Media' | 'Baja';
  completed: boolean;
}

const initialTasks: Task[] = [
  { id: 1, title: 'Limpiar habitación 101', due: 'Hoy', detail: 'Revisar minibar y cambiar sábanas', priority: 'Alta', completed: false },
  { id: 2, title: 'Preparar habitación 205', due: 'Hoy', detail: 'Reposición de amenities y aspirado', priority: 'Media', completed: false },
  { id: 3, title: 'Revisar stock de suministros', due: 'Mañana', detail: 'Verificar inventario de toallas y jabones', priority: 'Baja', completed: false }
];

export const WorkerTasks: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);

  const toggleComplete = (id: number) => {
    setTasks((prev) => prev.map((task) => (task.id === id ? { ...task, completed: !task.completed } : task)));
  };

  return (
    <div className="worker-page">
      <div className="page-header">
        <h2>Mis Tareas</h2>
        <p>Marca tu progreso y ve el estado de cada actividad.</p>
      </div>

      <div className="tasks-list">
        {tasks.map((task) => (
          <div key={task.id} className={`task-item ${task.completed ? 'task-completed' : ''}`}>
            <div className="task-meta">
              <div className="task-info">
                <h3>{task.title}</h3>
                <p>{task.detail}</p>
              </div>
              <div className="task-badge">{task.priority}</div>
            </div>
            <div className="task-footer">
              <span>Entrega: {task.due}</span>
              <button onClick={() => toggleComplete(task.id)} className="task-btn">
                {task.completed ? 'Desmarcar' : 'Completar'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

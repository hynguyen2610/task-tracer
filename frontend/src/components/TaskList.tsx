import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd"
import type { DropResult } from "@hello-pangea/dnd"
import type { Task } from "../types"
import TaskItem from "./TaskItem"

interface TaskListProps {
  tasks: Task[]
  editingId: number | null
  editTitle: string
  setEditTitle: (v: string) => void
  editTime: string
  setEditTime: (v: string) => void
  editPriority: Task["priority"]
  setEditPriority: (v: Task["priority"]) => void
  startEditing: (task: Task) => void
  saveEdit: (id: number) => void
  toggleTask: (id: number) => void
  deleteTask: (id: number) => void
  handleDragEnd: (result: DropResult) => void
}

export default function TaskList({
  tasks, editingId, editTitle, setEditTitle, editTime, setEditTime,
  editPriority, setEditPriority, startEditing, saveEdit,
  toggleTask, deleteTask, handleDragEnd
}: TaskListProps) {
  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Droppable droppableId="task-list">
        {(provided) => (
          <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-4">
            {tasks.map((task, index) => (
              <Draggable key={task.id} draggableId={task.id.toString()} index={index}>
                {(provided) => (
                  <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}>
                    <TaskItem
                      task={task}
                      index={index}
                      editingId={editingId}
                      editTitle={editTitle}
                      setEditTitle={setEditTitle}
                      editTime={editTime}
                      setEditTime={setEditTime}
                      editPriority={editPriority}
                      setEditPriority={setEditPriority}
                      startEditing={startEditing}
                      saveEdit={saveEdit}
                      toggleTask={toggleTask}
                      deleteTask={deleteTask}
                    />
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  )
}

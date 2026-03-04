import { ChatTable } from "@/components/admin/ChatTable";

export default function AdminChatsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Управление чатами</h2>
        <p className="text-muted-foreground">
          Корпоративные чаты, в которых бот является администратором
        </p>
      </div>
      <ChatTable />
    </div>
  );
}

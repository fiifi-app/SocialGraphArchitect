import { useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { MessageSquare, TrendingUp, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { motion, useMotionValue, useTransform, PanInfo } from "framer-motion";

interface SwipeableRecordingCardProps {
  conversation: {
    id: string;
    title: string | null;
    recordedAt: Date;
  };
  displayTitle: string;
  stats: {
    introsOffered: number;
    introsMade: number;
  };
  onClick: () => void;
  onDelete: () => void;
}

export default function SwipeableRecordingCard({
  conversation,
  displayTitle,
  stats,
  onClick,
  onDelete,
}: SwipeableRecordingCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const constraintsRef = useRef(null);
  const x = useMotionValue(0);
  
  const deleteButtonOpacity = useTransform(x, [-100, -50, 0], [1, 0.5, 0]);
  const deleteButtonScale = useTransform(x, [-100, -50, 0], [1, 0.8, 0.5]);
  
  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.x < -80) {
      x.set(-80);
    } else {
      x.set(0);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDeleting(true);
    x.set(0);
    onDelete();
  };

  const handleCardClick = () => {
    if (x.get() < -10) {
      x.set(0);
    } else {
      onClick();
    }
  };

  return (
    <div 
      ref={constraintsRef}
      className="relative overflow-hidden rounded-lg"
      data-testid={`swipeable-card-${conversation.id}`}
    >
      <motion.div
        className="absolute right-0 top-0 bottom-0 flex items-center justify-center bg-destructive px-6"
        style={{ 
          opacity: deleteButtonOpacity,
          scale: deleteButtonScale,
        }}
      >
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="flex items-center justify-center text-destructive-foreground p-2"
          data-testid={`button-delete-conversation-${conversation.id}`}
        >
          <Trash2 className="h-6 w-6" />
        </button>
      </motion.div>
      
      <motion.div
        drag="x"
        dragConstraints={{ left: -80, right: 0 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        style={{ x }}
        className="relative z-10"
      >
        <Card
          className="p-4 hover-elevate cursor-pointer bg-card"
          onClick={handleCardClick}
          data-testid={`card-conversation-${conversation.id}`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold mb-2 truncate">
                {displayTitle}
              </h4>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1.5">
                  <MessageSquare className={`h-3.5 w-3.5 ${stats.introsOffered > 0 ? 'text-sky-400' : 'text-muted-foreground'}`} />
                  <span className={stats.introsOffered > 0 ? 'text-sky-400' : 'text-muted-foreground'}>
                    {stats.introsOffered} intro{stats.introsOffered !== 1 ? 's' : ''} offered
                  </span>
                </div>
                <Separator orientation="vertical" className="h-4" />
                <div className="flex items-center gap-1.5">
                  <TrendingUp className={`h-3.5 w-3.5 ${stats.introsMade > 0 ? 'text-emerald-400' : 'text-muted-foreground'}`} />
                  <span className={stats.introsMade > 0 ? 'text-emerald-400' : 'text-muted-foreground'}>
                    {stats.introsMade} intro{stats.introsMade !== 1 ? 's' : ''} made
                  </span>
                </div>
              </div>
            </div>
            <div className="text-xs text-muted-foreground whitespace-nowrap">
              {format(conversation.recordedAt, 'h:mm a')}
            </div>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}

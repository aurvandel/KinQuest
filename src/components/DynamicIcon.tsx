import {
  Key,
  QrCode,
  Leaf,
  BookOpen,
  Coffee,
  Palette,
  Tv,
  Clock,
  Flower2,
  Sparkles,
  Coins,
  Footprints,
  AlertCircle,
  HelpCircle
} from "lucide-react";

interface DynamicIconProps {
  name: string;
  className?: string;
}

export function DynamicIcon({ name, className = "h-5 w-5" }: DynamicIconProps) {
  switch (name) {
    case "Key":
      return <Key className={className} />;
    case "QrCode":
      return <QrCode className={className} />;
    case "Leaf":
      return <Leaf className={className} />;
    case "BookOpen":
      return <BookOpen className={className} />;
    case "Coffee":
      return <Coffee className={className} />;
    case "Palette":
      return <Palette className={className} />;
    case "Tv":
      return <Tv className={className} />;
    case "Clock":
      return <Clock className={className} />;
    case "Flower2":
      return <Flower2 className={className} />;
    case "Sparkles":
      return <Sparkles className={className} />;
    case "Coins":
      return <Coins className={className} />;
    case "Footprints":
      return <Footprints className={className} />;
    default:
      return <HelpCircle className={className} />;
  }
}

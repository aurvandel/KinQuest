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
  HelpCircle,
  Briefcase,
  Globe,
  TreeDeciduousIcon,
  Gift,
  Flashlight,
  Volume2,
  CookingPot,
  GlassWater,
  IceCream,
  Candy,
  Donut,
  Wind,
  Gamepad2,
  Waves,
  MapPin,
  Flag,
  Spade,
  Tent,
  Droplets,
  Plane,
  Users,
  Heart,
  Camera,
  Flame,
  Laugh,
  Music,
  Apple
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
    case "Briefcase":
      return <Briefcase className={className} />;
    case "Globe":
      return <Globe className={className} />;
    case "Tree":
      return <TreeDeciduousIcon className={className} />;
    case "Gift":
      return <Gift className={className} />;
    case "Book":
      return <BookOpen className={className} />;
    case "Flashlight":
      return <Flashlight className={className} />;
    case "VolumeUp":
      return <Volume2 className={className} />;
    case "Pot":
      return <CookingPot className={className} />;
    case "Glass":
      return <GlassWater className={className} />;
    case "IceCream":
      return <IceCream className={className} />;
    case "Candy":
      return <Candy className={className} />;
    case "Donut":
      return <Donut className={className} />;
    case "Popcorn":
      return <Wind className={className} />;
    case "Basketball":
      return <AlertCircle className={className} />;
    case "Golf":
      return <AlertCircle className={className} />;
    case "Playground":
      return <Gamepad2 className={className} />;
    case "Water":
      return <Waves className={className} />;
    case "Sign":
      return <MapPin className={className} />;
    case "Apple":
      return <Apple className={className} />;
    case "Monster":
      return <AlertCircle className={className} />;
    case "Map":
      return <Globe className={className} />;
    case "Flag":
      return <Flag className={className} />;
    case "Cards":
      return <Spade className={className} />;
    case "Tent":
      return <Tent className={className} />;
    case "WaterDrop":
      return <Droplets className={className} />;
    case "Parachute":
      return <Plane className={className} />;
    case "Users":
      return <Users className={className} />;
    case "Heart":
      return <Heart className={className} />;
    case "Camera":
      return <Camera className={className} />;
    case "Flame":
      return <Flame className={className} />;
    case "Laugh":
      return <Laugh className={className} />;
    case "Music":
      return <Music className={className} />;
    default:
      return <HelpCircle className={className} />;
  }
}

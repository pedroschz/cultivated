// Layout Components
export { MainLayout } from "./layout/main-layout";
export { PageHeader } from "./layout/page-header";
export { Sidebar } from "./layout/sidebar";
export { NavigationErrorBoundary } from "./layout/navigation-error-boundary";

// UI Components
export { Loading, PageLoading, CardLoading } from "./ui/loading";
export { ErrorBoundary, ErrorFallback, PageError } from "./ui/error-boundary";
export { ProgressIndicator, StepProgress, CircularProgress } from "./ui/progress-indicator";

// Re-export shadcn/ui components for convenience
export { Button } from "./ui/button";
export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/card";
export { Input } from "./ui/input";
export { Label } from "./ui/label";
export { Textarea } from "./ui/textarea";
export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

export { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
export { Badge } from "./ui/badge";
export { Progress } from "./ui/progress";

export { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
export { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "./ui/alert-dialog";
export { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
export { Separator } from "./ui/separator";
export { Skeleton } from "./ui/skeleton";

export { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "./ui/breadcrumb";
export { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, CommandShortcut } from "./ui/command";

export { Calendar } from "./ui/calendar";
export { Switch } from "./ui/switch";
export { Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "./ui/table";
export { Toaster } from "./ui/sonner";
export { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "./ui/chart";
export { ScoreCard } from './ui/score-card';
export { ProcedureConnectButton } from './ui/procedure-connect';
export { ProcedureQR } from './ui/procedure-qr';
export { ProcedureScore } from './ui/procedure-score';

// Dashboard Modern UI
export { HeroSection } from "./dashboard/HeroSection";
export { HistoricalMasteryCard } from "./dashboard/HistoricalMasteryCard";

// Voice Components
export { AutoVoiceRecorder } from "./voice/AutoVoiceRecorder";
export { CompactVoiceConversation } from "./voice/CompactVoiceConversation";

// Onboarding Components
export { FirstTimeExperience, MicPermissionExplanation, FirstWrongAnswerTutorial, FirstSessionComplete } from "./onboarding"; 

// Theming
export { ThemeProvider } from "./theme-provider";
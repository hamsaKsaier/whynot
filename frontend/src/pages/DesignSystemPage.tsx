import { useState } from "react"
import { cn } from "../lib/utils"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Textarea } from "../components/ui/textarea"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "../components/ui/card"
import { Badge } from "../components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs"
import { Switch } from "../components/ui/switch"
import { Checkbox } from "../components/ui/checkbox"
import { Separator } from "../components/ui/separator"
import { Skeleton } from "../components/ui/skeleton"
import { Progress } from "../components/ui/progress"
import {
  Alert,
  AlertTitle,
  AlertDescription,
} from "../components/ui/alert"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "../components/ui/table"
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "../components/ui/accordion"
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../components/ui/dialog"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "../components/ui/select"
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group"
import { Slider } from "../components/ui/slider"
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "../components/ui/tooltip"
import { Avatar, AvatarImage, AvatarFallback } from "../components/ui/avatar"
import { ThemeToggle } from "../components/ui/theme-toggle"
import { AlertCircle, CheckCircle2, Info } from "lucide-react"

function ColorSwatch({
  name,
  variable,
}: {
  name: string
  variable: string
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="h-10 w-10 rounded-md border"
        style={{ backgroundColor: `oklch(var(${variable}))` }}
      />
      <div>
        <p className="text-sm font-medium">{name}</p>
        <p className="text-xs text-muted-foreground">{variable}</p>
      </div>
    </div>
  )
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="text-2xl font-semibold mb-6">{children}</h2>
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="text-lg font-medium mb-4">{children}</h3>
}

export function DesignSystemPage() {
  const [direction, setDirection] = useState<"ltr" | "rtl">("ltr")

  const toggleDirection = () => {
    const newDir = direction === "ltr" ? "rtl" : "ltr"
    setDirection(newDir)
    document.documentElement.setAttribute("dir", newDir)
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background text-foreground p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Design System</h1>
            <p className="text-muted-foreground mt-1">
              whynot token + primitive showcase
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={toggleDirection}>
              {direction === "ltr" ? "LTR" : "RTL"}
            </Button>
            <ThemeToggle />
          </div>
        </div>

        <Separator className="mb-8" />

        {/* ---------------------------------------------------------------- */}
        {/* TOKENS SECTION                                                   */}
        {/* ---------------------------------------------------------------- */}
        <section className="mb-12">
          <SectionHeading>Tokens</SectionHeading>

          {/* Colors */}
          <div className="mb-8">
            <SubHeading>Colors</SubHeading>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              <ColorSwatch name="Background" variable="--background" />
              <ColorSwatch name="Foreground" variable="--foreground" />
              <ColorSwatch name="Primary" variable="--primary" />
              <ColorSwatch name="Primary FG" variable="--primary-foreground" />
              <ColorSwatch name="Secondary" variable="--secondary" />
              <ColorSwatch
                name="Secondary FG"
                variable="--secondary-foreground"
              />
              <ColorSwatch name="Muted" variable="--muted" />
              <ColorSwatch name="Muted FG" variable="--muted-foreground" />
              <ColorSwatch name="Accent" variable="--accent" />
              <ColorSwatch name="Accent FG" variable="--accent-foreground" />
              <ColorSwatch name="Destructive" variable="--destructive" />
              <ColorSwatch name="Border" variable="--border" />
              <ColorSwatch name="Input" variable="--input" />
              <ColorSwatch name="Ring" variable="--ring" />
              <ColorSwatch name="Card" variable="--card" />
              <ColorSwatch name="Popover" variable="--popover" />
              <ColorSwatch name="Chart 1" variable="--chart-1" />
              <ColorSwatch name="Chart 2" variable="--chart-2" />
              <ColorSwatch name="Chart 3" variable="--chart-3" />
              <ColorSwatch name="Chart 4" variable="--chart-4" />
              <ColorSwatch name="Chart 5" variable="--chart-5" />
            </div>
          </div>

          {/* Typography */}
          <div className="mb-8">
            <SubHeading>Typography</SubHeading>
            <div className="space-y-3">
              <p className="text-xs">text-xs -- 0.75rem (12px)</p>
              <p className="text-sm">text-sm -- 0.875rem (14px)</p>
              <p className="text-base">text-base -- 1rem (16px)</p>
              <p className="text-lg">text-lg -- 1.125rem (18px)</p>
              <p className="text-xl">text-xl -- 1.25rem (20px)</p>
              <p className="text-2xl">text-2xl -- 1.5rem (24px)</p>
              <p className="text-3xl">text-3xl -- 1.875rem (30px)</p>
              <p className="text-4xl">text-4xl -- 2.25rem (36px)</p>
            </div>
          </div>

          {/* Font Weights */}
          <div className="mb-8">
            <SubHeading>Font Weights</SubHeading>
            <div className="space-y-2">
              <p className="font-light">Light (300)</p>
              <p className="font-normal">Normal (400)</p>
              <p className="font-medium">Medium (500)</p>
              <p className="font-semibold">Semibold (600)</p>
              <p className="font-bold">Bold (700)</p>
            </div>
          </div>

          {/* Border Radius */}
          <div className="mb-8">
            <SubHeading>Border Radius</SubHeading>
            <div className="flex flex-wrap gap-4">
              {["rounded-sm", "rounded-md", "rounded-lg"].map((r) => (
                <div key={r} className="text-center">
                  <div className={cn("h-16 w-16 bg-primary", r)} />
                  <p className="text-xs text-muted-foreground mt-2">{r}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Shadows */}
          <div className="mb-8">
            <SubHeading>Shadows</SubHeading>
            <div className="flex flex-wrap gap-6">
              {["shadow-sm", "shadow"].map((s) => (
                <div key={s} className="text-center">
                  <div
                    className={cn("h-16 w-16 rounded-lg bg-card border", s)}
                  />
                  <p className="text-xs text-muted-foreground mt-2">{s}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <Separator className="mb-8" />

        {/* ---------------------------------------------------------------- */}
        {/* PRIMITIVES SECTION                                               */}
        {/* ---------------------------------------------------------------- */}
        <section className="mb-12">
          <SectionHeading>Primitives</SectionHeading>

          {/* Buttons */}
          <div className="mb-8">
            <SubHeading>Button</SubHeading>
            <div className="flex flex-wrap gap-3 mb-4">
              <Button variant="default">Default</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="destructive">Destructive</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="link">Link</Button>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button size="sm">Small</Button>
              <Button size="default">Default</Button>
              <Button size="lg">Large</Button>
              <Button size="icon">
                <Info className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Inputs */}
          <div className="mb-8">
            <SubHeading>Input & Textarea</SubHeading>
            <div className="grid gap-4 max-w-md">
              <div className="space-y-2">
                <Label htmlFor="demo-input">Email</Label>
                <Input id="demo-input" placeholder="name@example.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="demo-textarea">Message</Label>
                <Textarea
                  id="demo-textarea"
                  placeholder="Type your message..."
                />
              </div>
            </div>
          </div>

          {/* Select */}
          <div className="mb-8">
            <SubHeading>Select</SubHeading>
            <div className="max-w-xs">
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a framework" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="react">React</SelectItem>
                  <SelectItem value="vue">Vue</SelectItem>
                  <SelectItem value="svelte">Svelte</SelectItem>
                  <SelectItem value="angular">Angular</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Checkbox, RadioGroup, Switch */}
          <div className="mb-8">
            <SubHeading>Selection Controls</SubHeading>
            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <Checkbox id="terms" />
                <Label htmlFor="terms">Accept terms and conditions</Label>
              </div>
              <div>
                <Label className="mb-2 block">Preferred contact</Label>
                <RadioGroup defaultValue="email" className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="email" id="contact-email" />
                    <Label htmlFor="contact-email">Email</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="phone" id="contact-phone" />
                    <Label htmlFor="contact-phone">Phone</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="sms" id="contact-sms" />
                    <Label htmlFor="contact-sms">SMS</Label>
                  </div>
                </RadioGroup>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="airplane" />
                <Label htmlFor="airplane">Airplane mode</Label>
              </div>
            </div>
          </div>

          {/* Slider */}
          <div className="mb-8">
            <SubHeading>Slider</SubHeading>
            <Slider defaultValue={[50]} max={100} step={1} className="max-w-md" />
          </div>

          {/* Card */}
          <div className="mb-8">
            <SubHeading>Card</SubHeading>
            <Card className="max-w-sm">
              <CardHeader>
                <CardTitle>Card Title</CardTitle>
                <CardDescription>
                  Card description text goes here.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm">
                  Card content with some example text.
                </p>
              </CardContent>
              <CardFooter>
                <Button size="sm">Action</Button>
              </CardFooter>
            </Card>
          </div>

          {/* Dialog */}
          <div className="mb-8">
            <SubHeading>Dialog</SubHeading>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">Open Dialog</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Dialog Title</DialogTitle>
                  <DialogDescription>
                    This is a sample dialog description.
                  </DialogDescription>
                </DialogHeader>
                <p className="text-sm text-muted-foreground">
                  Dialog body content goes here.
                </p>
                <DialogFooter>
                  <Button variant="outline">Cancel</Button>
                  <Button>Confirm</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Tabs */}
          <div className="mb-8">
            <SubHeading>Tabs</SubHeading>
            <Tabs defaultValue="tab1" className="max-w-md">
              <TabsList>
                <TabsTrigger value="tab1">General</TabsTrigger>
                <TabsTrigger value="tab2">Settings</TabsTrigger>
                <TabsTrigger value="tab3">Advanced</TabsTrigger>
              </TabsList>
              <TabsContent value="tab1">
                <p className="text-sm text-muted-foreground p-4">
                  General tab content.
                </p>
              </TabsContent>
              <TabsContent value="tab2">
                <p className="text-sm text-muted-foreground p-4">
                  Settings tab content.
                </p>
              </TabsContent>
              <TabsContent value="tab3">
                <p className="text-sm text-muted-foreground p-4">
                  Advanced tab content.
                </p>
              </TabsContent>
            </Tabs>
          </div>

          {/* Accordion */}
          <div className="mb-8">
            <SubHeading>Accordion</SubHeading>
            <Accordion type="single" collapsible className="max-w-md">
              <AccordionItem value="item-1">
                <AccordionTrigger>What is whynot?</AccordionTrigger>
                <AccordionContent>
                  An AI-powered QA platform for automated testing.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-2">
                <AccordionTrigger>How does it work?</AccordionTrigger>
                <AccordionContent>
                  It uses AI to generate and execute test cases automatically.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          {/* Badge */}
          <div className="mb-8">
            <SubHeading>Badge</SubHeading>
            <div className="flex flex-wrap gap-3">
              <Badge variant="default">Default</Badge>
              <Badge variant="secondary">Secondary</Badge>
              <Badge variant="destructive">Destructive</Badge>
              <Badge variant="outline">Outline</Badge>
            </div>
          </div>

          {/* Alert */}
          <div className="mb-8">
            <SubHeading>Alert</SubHeading>
            <div className="space-y-4 max-w-lg">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Information</AlertTitle>
                <AlertDescription>
                  This is a default alert message.
                </AlertDescription>
              </Alert>
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>Something went wrong.</AlertDescription>
              </Alert>
            </div>
          </div>

          {/* Table */}
          <div className="mb-8">
            <SubHeading>Table</SubHeading>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-start">Name</TableHead>
                  <TableHead className="text-start">Status</TableHead>
                  <TableHead className="text-end">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>Login flow</TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      <CheckCircle2 className="h-3 w-3 me-1" />
                      Passed
                    </Badge>
                  </TableCell>
                  <TableCell className="text-end">
                    <Button variant="ghost" size="sm">
                      View
                    </Button>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Checkout flow</TableCell>
                  <TableCell>
                    <Badge variant="destructive">
                      <AlertCircle className="h-3 w-3 me-1" />
                      Failed
                    </Badge>
                  </TableCell>
                  <TableCell className="text-end">
                    <Button variant="ghost" size="sm">
                      View
                    </Button>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Registration</TableCell>
                  <TableCell>
                    <Badge variant="outline">Pending</Badge>
                  </TableCell>
                  <TableCell className="text-end">
                    <Button variant="ghost" size="sm">
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {/* Progress */}
          <div className="mb-8">
            <SubHeading>Progress</SubHeading>
            <div className="space-y-4 max-w-md">
              <div>
                <p className="text-sm text-muted-foreground mb-2">66%</p>
                <Progress value={66} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-2">33%</p>
                <Progress value={33} />
              </div>
            </div>
          </div>

          {/* Separator */}
          <div className="mb-8">
            <SubHeading>Separator</SubHeading>
            <div className="max-w-md space-y-2">
              <p className="text-sm">Content above</p>
              <Separator />
              <p className="text-sm">Content below</p>
            </div>
          </div>

          {/* Skeleton */}
          <div className="mb-8">
            <SubHeading>Skeleton</SubHeading>
            <div className="flex items-center gap-4">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-[250px]" />
                <Skeleton className="h-4 w-[200px]" />
              </div>
            </div>
          </div>

          {/* Tooltip */}
          <div className="mb-8">
            <SubHeading>Tooltip</SubHeading>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline">Hover me</Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>This is a tooltip</p>
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Avatar */}
          <div className="mb-8">
            <SubHeading>Avatar</SubHeading>
            <div className="flex items-center gap-4">
              <Avatar>
                <AvatarImage
                  src="https://github.com/shadcn.png"
                  alt="Avatar"
                />
                <AvatarFallback>CN</AvatarFallback>
              </Avatar>
              <Avatar>
                <AvatarFallback>JD</AvatarFallback>
              </Avatar>
              <Avatar>
                <AvatarFallback>WN</AvatarFallback>
              </Avatar>
            </div>
          </div>
        </section>

        <Separator className="mb-8" />

        {/* ---------------------------------------------------------------- */}
        {/* STATES SECTION                                                   */}
        {/* ---------------------------------------------------------------- */}
        <section className="mb-12">
          <SectionHeading>States</SectionHeading>

          {/* Button states */}
          <div className="mb-8">
            <SubHeading>Button States</SubHeading>
            <div className="flex flex-wrap gap-3">
              <Button>Normal</Button>
              <Button disabled>Disabled</Button>
              <Button variant="outline">Outline Normal</Button>
              <Button variant="outline" disabled>
                Outline Disabled
              </Button>
              <Button variant="destructive">Destructive Normal</Button>
              <Button variant="destructive" disabled>
                Destructive Disabled
              </Button>
            </div>
          </div>

          {/* Input states */}
          <div className="mb-8">
            <SubHeading>Input States</SubHeading>
            <div className="grid gap-4 max-w-md">
              <div className="space-y-2">
                <Label>Default</Label>
                <Input placeholder="Default state" />
              </div>
              <div className="space-y-2">
                <Label>Disabled</Label>
                <Input placeholder="Disabled state" disabled />
              </div>
              <div className="space-y-2">
                <Label className="text-destructive">Error</Label>
                <Input
                  placeholder="Error state"
                  className="border-destructive focus-visible:ring-destructive"
                />
                <p className="text-sm text-destructive">
                  This field is required.
                </p>
              </div>
              <div className="space-y-2">
                <Label>With value</Label>
                <Input defaultValue="user@example.com" />
              </div>
            </div>
          </div>

          {/* Focus demo note */}
          <div className="mb-8">
            <SubHeading>Focus & Hover</SubHeading>
            <p className="text-sm text-muted-foreground mb-4">
              Click or tab into the inputs and buttons above to see focus ring
              styles. Hover over buttons to see hover state transitions.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline">
                Tab to me for focus ring
              </Button>
              <Input
                placeholder="Tab to me for focus ring"
                className="max-w-xs"
              />
            </div>
          </div>
        </section>
      </div>
    </TooltipProvider>
  )
}

import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Package, Plus, Minus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { EmptyState } from "@/components/app/EmptyState";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UNITS, type Product } from "@/lib/business/constants";
import {
  useBusiness,
  useCreateProduct,
  useDeleteProduct,
  useProducts,
  useUpdateProduct,
} from "@/lib/data/hooks";
import { money } from "@/lib/format";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/products")({
  head: () => ({
    meta: [
      { title: "Stock & items — Vyapaar Saathi" },
      {
        name: "description",
        content: "Keep prices and stock for the items you sell, and spot low stock early.",
      },
      { property: "og:title", content: "Stock & items — Vyapaar Saathi" },
      {
        property: "og:description",
        content: "Keep prices and stock for the items you sell, and spot low stock early.",
      },
    ],
  }),
  component: ProductsPage,
});

function ProductsPage() {
  const t = useT();
  const { data: business } = useBusiness();
  const { data: products = [] } = useProducts(business?.id);
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();

  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("pcs");
  const [sell, setSell] = useState("");
  const [buy, setBuy] = useState("");
  const [stock, setStock] = useState("");
  const [threshold, setThreshold] = useState("");

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? products.filter((p) => p.name.toLowerCase().includes(q)) : products;
    return [...filtered].sort((a, b) => Number(isLow(b)) - Number(isLow(a)));
  }, [products, query]);

  const lowCount = products.filter(isLow).length;

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!business || !name.trim()) return;
    try {
      await createProduct.mutateAsync({
        business_id: business.id,
        name: name.trim(),
        unit,
        selling_price: Number(sell) || 0,
        purchase_price: Number(buy) || 0,
        stock: Number(stock) || 0,
        low_stock_threshold: Number(threshold) || 0,
      });
      toast.success(t("common.saved"));
      setName("");
      setSell("");
      setBuy("");
      setStock("");
      setThreshold("");
      setAdding(false);
    } catch {
      toast.error(t("common.error"));
    }
  };

  const bumpStock = (product: Product, delta: number) => {
    const next = Math.max(0, Number(product.stock) + delta);
    updateProduct.mutate({ id: product.id, stock: next });
  };

  return (
    <AppShell title={t("products.title")} back="/more">
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("common.search")}
          className="h-12 text-base"
        />
        <Button size="lg" onClick={() => setAdding(true)} aria-label={t("products.add")}>
          <Plus className="size-5" aria-hidden />
        </Button>
      </div>

      {lowCount ? (
        <p className="mt-3 rounded-2xl bg-pending-soft px-4 py-3 font-semibold text-pending">
          {t("products.lowStock")} · {lowCount}
        </p>
      ) : null}

      {list.length ? (
        <ul className="mt-3 space-y-3">
          {list.map((product) => (
            <li key={product.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{product.name}</p>
                  <p className="num text-sm text-muted-foreground">
                    {t("products.sellPrice")} {money(product.selling_price)} ·{" "}
                    {t("products.buyPrice")} {money(product.purchase_price)}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={t("common.delete")}
                  onClick={() => deleteProduct.mutate(product.id)}
                  className="tap shrink-0 rounded-full p-1 text-muted-foreground"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </div>

              <div className="mt-3 flex items-center justify-between gap-3">
                <span
                  className={`num font-bold ${isLow(product) ? "text-pending" : "text-foreground"}`}
                >
                  {t("products.stock")}: {Number(product.stock)} {product.unit}
                </span>
                <span className="flex gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="-1"
                    onClick={() => bumpStock(product, -1)}
                  >
                    <Minus className="size-4" aria-hidden />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="+1"
                    onClick={() => bumpStock(product, 1)}
                  >
                    <Plus className="size-4" aria-hidden />
                  </Button>
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-3">
          <EmptyState icon={<Package className="size-8" />} title={t("common.none")} />
        </div>
      )}

      <Drawer open={adding} onOpenChange={setAdding}>
        <DrawerContent className="max-h-[92vh]">
          <DrawerHeader>
            <DrawerTitle>{t("products.add")}</DrawerTitle>
          </DrawerHeader>
          <form className="space-y-4 overflow-y-auto px-4 pb-8" onSubmit={save}>
            <div>
              <Label htmlFor="pr-name">{t("common.name")}</Label>
              <Input
                id="pr-name"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-1.5 h-12 text-base"
              />
            </div>

            <div>
              <Label htmlFor="pr-unit">{t("products.unit")}</Label>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {UNITS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={unit === value}
                    onClick={() => setUnit(value)}
                    className={`min-h-10 rounded-full border px-3 text-sm font-semibold ${
                      unit === value
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card"
                    }`}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="pr-sell">{t("products.sellPrice")}</Label>
                <Input
                  id="pr-sell"
                  inputMode="decimal"
                  value={sell}
                  onChange={(event) => setSell(event.target.value)}
                  className="num mt-1.5 h-12 text-base"
                />
              </div>
              <div>
                <Label htmlFor="pr-buy">{t("products.buyPrice")}</Label>
                <Input
                  id="pr-buy"
                  inputMode="decimal"
                  value={buy}
                  onChange={(event) => setBuy(event.target.value)}
                  className="num mt-1.5 h-12 text-base"
                />
              </div>
              <div>
                <Label htmlFor="pr-stock">{t("products.stock")}</Label>
                <Input
                  id="pr-stock"
                  inputMode="decimal"
                  value={stock}
                  onChange={(event) => setStock(event.target.value)}
                  className="num mt-1.5 h-12 text-base"
                />
              </div>
              <div>
                <Label htmlFor="pr-low">{t("products.lowStock")}</Label>
                <Input
                  id="pr-low"
                  inputMode="decimal"
                  value={threshold}
                  onChange={(event) => setThreshold(event.target.value)}
                  className="num mt-1.5 h-12 text-base"
                />
              </div>
            </div>

            <Button type="submit" size="lg" className="w-full" disabled={!name.trim()}>
              {t("common.save")}
            </Button>
          </form>
        </DrawerContent>
      </Drawer>
    </AppShell>
  );
}

function isLow(product: Product) {
  return (
    Number(product.low_stock_threshold) > 0 &&
    Number(product.stock) <= Number(product.low_stock_threshold)
  );
}

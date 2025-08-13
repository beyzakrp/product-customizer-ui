# 🚀 **Shopify Metafield JSON Editor App**

## 📋 **Proje Özeti**

Bu app, Shopify ürünlerindeki metafield'ları JSON yazmadan, kullanıcı dostu bir arayüzle düzenlemek için geliştirilmiştir. E-commerce ekibi, ürün özelleştirme seçeneklerini (renk, header tipi, grommet, boyut) kolayca yönetebilir.

## ✨ **Özellikler**

- 🎨 **Kullanıcı Dostu Arayüz**: JSON yazmadan metafield düzenleme
- 📝 **Dinamik Form Alanları**: Renk, header, grommet, boyut seçenekleri
- ✅ **Validasyon**: Otomatik form doğrulama ve hata kontrolü
- 🔄 **Gerçek Zamanlı Kaydetme**: Değişiklikleri anında Shopify'a kaydetme
- 📱 **Responsive Tasarım**: Mobil ve masaüstü uyumlu
- 🛡️ **Güvenli**: Shopify Admin API ile güvenli entegrasyon

## 🛠️ **Teknolojiler**

- **Frontend**: React, Remix, Shopify Polaris
- **Backend**: Node.js, Remix
- **API**: Shopify Admin GraphQL API
- **Styling**: Shopify Polaris Design System

## 📁 **Dosya Yapısı**

```
product-customizer-ui/
├── app/
│   ├── components/
│   │   └── MetafieldEditor.jsx      # Ana metafield editör component'i
│   ├── routes/
│   │   ├── app._index.jsx           # Ana sayfa
│   │   ├── products.jsx             # Ürün listesi
│   │   └── products.$id.jsx         # Ürün detay ve metafield düzenleme
│   ├── utils/
│   │   └── metafield.js             # Yardımcı fonksiyonlar
│   ├── shopify.server.js            # Shopify auth & API
│   └── root.jsx                     # App root
├── shopify.app.toml                 # App konfigürasyonu
└── package.json                     # Dependencies
```

## 🚀 **Kurulum ve Çalıştırma**

### **Gereksinimler**
- Node.js 18+ 
- Shopify CLI
- Shopify Partner hesabı

### **Kurulum Adımları**

1. **Projeyi klonlayın**
```bash
git clone <repository-url>
cd product-customizer-ui
```

2. **Bağımlılıkları yükleyin**
```bash
npm install
```

3. **Shopify app'i bağlayın**
```bash
npm run config:link
```

4. **Geliştirme sunucusunu başlatın**
```bash
npm run dev
```

5. **App'i test store'a yükleyin**
```bash
npm run deploy
```

## 📖 **Kullanım Kılavuzu**

### **1. Ana Sayfa**
- App'in genel bilgilerini görüntüler
- "Ürünleri Görüntüle" butonu ile ürün listesine geçiş
- Test ürünü oluşturma özelliği

### **2. Ürün Listesi**
- Mağazanızdaki tüm ürünleri listeler
- Her ürün için durum bilgisi
- "Özelleştirme Seçenekleri" butonu ile düzenleme

### **3. Metafield Editörü**
- **Alan Ekleme**: Yeni özelleştirme alanı ekleme
- **Alan Tipleri**: Renk, Header, Grommet, Boyut, Metin, Sayı, Resim URL
- **Seçenek Yönetimi**: Her alan için seçenek ekleme/silme
- **Validasyon**: Otomatik form doğrulama
- **Kaydetme**: Değişiklikleri Shopify'a kaydetme

### **4. Alan Tipleri ve Özellikleri**

#### **Renk (Color)**
- Önceden tanımlı renk seçenekleri
- Özel renk değerleri ekleme
- Hex kod desteği

#### **Header Tipi**
- Standart, Özel, Minimal seçenekleri
- Özel header tipleri ekleme

#### **Grommet**
- Yuvarlak, Kare, Oval seçenekleri
- Özel grommet tipleri

#### **Boyut**
- Küçük, Orta, Büyük seçenekleri
- Özel boyut değerleri

#### **Metin**
- Serbest metin girişi
- Varsayılan değer ayarlama

#### **Sayı**
- Numerik değer girişi
- Minimum/maksimum değer kontrolü

#### **Resim URL**
- Resim URL'si girişi
- Önizleme özelliği

## 🔧 **Configuration**

### **Shopify App Settings**
```toml
# shopify.app.toml
name = "Product Customizer"
client_id = "your_client_id"
application_url = "https://your-app-url.com"
embedded = true

[access_scopes]
scopes = "write_products,read_products,write_product_listings,read_product_listings"
```

### **Metafield Namespace**
App uses `customizer` namespace:
- **Namespace**: `customizer`
- **Key**: `options`
- **Type**: `json`

## 📊 **Metafield JSON Structure**

```json
[
  {
    "type": "color",
    "label": "Product Color",
    "key": "product_color",
    "required": true,
    "options": [
      { "label": "Red", "value": "red" },
      { "label": "Blue", "value": "blue" },
      { "label": "Green", "value": "green" }
    ],
    "defaultValue": "red"
  },
  {
    "type": "size",
    "label": "Product Size",
    "key": "product_size",
    "required": false,
    "options": [
      { "label": "Küçük", "value": "small" },
      { "label": "Orta", "value": "medium" },
      { "label": "Büyük", "value": "large" }
    ],
    "defaultValue": "medium"
  }
]
```

## 🚀 **Deployment**

### **Production**
```bash
# Deploy app to production
npm run deploy

# Update environment variables
npm run env:push
```

### **Development**
```bash
# Start development server
npm run dev

# Open app in test store
npm run open
```

## 🔍 **Troubleshooting**

### **Common Issues**

1. **Metafield not saving**
   - Check Shopify API permissions
   - Ensure the metafield namespace is correct

2. **App not loading**
   - Ensure Shopify CLI is up to date
   - Check if the app is registered in your partner account

3. **GraphQL hataları**
   - Check if the API version is up to date
   - Ensure access scopes are correctly set

## 🤝 **Contributing**

1. Fork
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit (`git commit -m 'Add amazing feature'`)
4. Push (`git push origin feature/amazing-feature`)
5. Create a pull request

## 📞 **Contact**

- **Developer**: Beyza Karapıçak
- **Email**: contact.karapicak@gmail.com
- **GitHub**: [github.com/beyzakrp](https://github.com/beyzakrp)

---

**Note**: This app is developed within the Shopify Partner Program and uses Shopify's official APIs.

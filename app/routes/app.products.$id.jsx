import { json } from "@remix-run/node";
import { useLoaderData, Form, useSubmit, useNavigation, useLocation } from "@remix-run/react";
import { useState } from "react";
import {
  Page,
  Layout,
  Card,
  Button,
  Banner,
  Text,
  InlineStack,
  Spinner,
  Badge,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import ColorOptionsEditor from "../components/ColorOptionsEditor";

export async function loader({ params, request }) {
  const { admin } = await authenticate.admin(request);
  const id = params.id;

  try {
    const response = await admin.graphql(
      `query {
        product(id: "gid://shopify/Product/${id}") {
          id
          title
          handle
          status
          metafields(namespace: "customizer", first: 10) {
            edges {
              node {
                id
                key
                value
                type
              }
            }
          }
        }
      }`
    );

    const data = await response.json();
    
    if (!data.data.product) {
      throw new Error("Ürün bulunamadı");
    }

    const product = data.data.product;
    const metafields = product.metafields.edges.map(e=>e.node);
    const colorMetafield = metafields.find(m=>m.key==="color_options");

    return json({ 
      product, 
      metafield: colorMetafield,
      success: true 
    });
  } catch (error) {
    return json({ 
      error: error.message || "Ürün yüklenirken hata oluştu",
      success: false 
    });
  }
}

export async function action({ request, params }) {
  const { admin } = await authenticate.admin(request);
  const id = params.id;
  const formData = await request.formData();
  const colorValue = formData.get("colorOptions");

  try {
    // Mevcut metafield var mı kontrol et
    const response = await admin.graphql(
      `query {
        product(id: "gid://shopify/Product/${id}") {
          metafields(namespace: "customizer", first: 10) {
            edges {
              node {
                id
                key
              }
            }
          }
        }
      }`
    );
    
    const data = await response.json();
    const metafields = data.data.product.metafields.edges.map(e=>e.node);
    const colorMetafield = metafields.find(m=>m.key==="color_options");

    // Güncelle veya oluştur
    if (colorMetafield) {
      const updateResponse = await admin.graphql(
        `mutation {
          metafieldsSet(metafields: [{
            id: "${colorMetafield.id}",
            value: ${JSON.stringify(colorValue)},
            valueType: JSON_STRING
          }]) {
            metafields {
              id
              value
            }
            userErrors {
              field
              message
            }
          }
        }`
      );
      
      const updateData = await updateResponse.json();
      
      if (updateData.data.metafieldsSet.userErrors.length > 0) {
        throw new Error(updateData.data.metafieldsSet.userErrors[0].message);
      }
    } else {
      const createResponse = await admin.graphql(
        `mutation {
          metafieldsSet(metafields: [{
            ownerId: "gid://shopify/Product/${id}",
            namespace: "customizer",
            key: "color_options",
            type: "json",
            value: ${JSON.stringify(colorValue)}
          }]) {
            metafields {
              id
              value
            }
            userErrors {
              field
              message
            }
          }
        }`
      );
      
      const createData = await createResponse.json();
      
      if (createData.data.metafieldsSet.userErrors.length > 0) {
        throw new Error(createData.data.metafieldsSet.userErrors[0].message);
      }
    }

    return json({ success: true, message: "Özelleştirme seçenekleri başarıyla kaydedildi" });
  } catch (error) {
    return json({ 
      success: false, 
      error: error.message || "Kaydetme sırasında hata oluştu" 
    });
  }
}

export default function ProductDetail() {
  const { product, metafield, success, error } = useLoaderData();
  const [showDebug, setShowDebug] = useState(false);
  const submit = useSubmit();
  const navigation = useNavigation();
  const location = useLocation();
  const isSubmitting = navigation.state === "submitting";

  if (!success) {
    return (
      <Page title="Hata">
        <Layout>
          <Layout.Section>
            <Card>
              <Banner tone="critical">
                <p>{error}</p>
              </Banner>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  const handleSave = (options) => {
    submit(
      { colorOptions: JSON.stringify(options) },
      { method: "post" }
    );
  };

  return (
    <Page 
      title={product.title}
      subtitle="Özelleştirme Seçenekleri"
      backAction={{
        content: "Ürünler",
        url: `/app/products${location.search}`,
      }}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <div style={{ padding: "20px" }}>
              <InlineStack align="space-between">
                <div>
                  <Text variant="headingMd" as="h2">
                    {product.title}
                  </Text>
                  <Text variant="bodyMd" as="p" tone="subdued">
                    Handle: {product.handle}
                  </Text>
                </div>
                <Badge status={product.status === "ACTIVE" ? "success" : "attention"}>
                  {product.status === "ACTIVE" ? "Aktif" : "Pasif"}
                </Badge>
              </InlineStack>
            </div>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Button onClick={() => setShowDebug(!showDebug)} variant="tertiary">
            {showDebug ? "Debug Gizle" : "Debug Göster"}
          </Button>
          {showDebug && (
            <Card>
              <pre style={{whiteSpace:"pre-wrap", wordBreak:"break-all"}}>
                {JSON.stringify({ product, metafield }, null, 2)}
              </pre>
            </Card>
          )}
        </Layout.Section>

        <Layout.Section>
          <Card>
            <div style={{ padding: "20px" }}>
              <Text variant="headingMd" as="h3" style={{ marginBottom: "16px" }}>
                Özelleştirme Seçenekleri
              </Text>
              
              {isSubmitting && (
                <div style={{ textAlign: "center", padding: "20px" }}>
                  <Spinner size="large" />
                  <Text variant="bodyMd" as="p" style={{ marginTop: "8px" }}>
                    Kaydediliyor...
                  </Text>
                </div>
              )}
              
              <ColorOptionsEditor
                initialValue={metafield?.value || "[]"}
                onSave={handleSave}
                onCancel={() => window.history.back()}
              />
            </div>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
} 
package com.example.offlineai;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.pdf.PdfRenderer;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.util.Base64;

import com.google.android.gms.tasks.Task;
import com.google.android.gms.tasks.Tasks;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.Text;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;

import java.io.File;
import java.io.FileOutputStream;
import java.util.concurrent.ExecutionException;

public class OfflineOcrEngine {

    /**
     * Extracts text from an image Base64 data URI using Google ML Kit.
     */
    public static String extractTextFromBase64Image(Context context, String base64Uri) throws Exception {
        String base64Data = base64Uri.substring(base64Uri.indexOf(",") + 1);
        byte[] decodedString = Base64.decode(base64Data, Base64.DEFAULT);
        Bitmap bitmap = BitmapFactory.decodeByteArray(decodedString, 0, decodedString.length);
        
        InputImage image = InputImage.fromBitmap(bitmap, 0);
        return runMlKitOcr(image);
    }

    /**
     * Extracts text from an image URI using Google ML Kit.
     */
    public static String extractTextFromImageUri(Context context, Uri uri) throws Exception {
        InputImage image = InputImage.fromFilePath(context, uri);
        return runMlKitOcr(image);
    }

    private static String runMlKitOcr(InputImage image) throws ExecutionException, InterruptedException {
        TextRecognizer recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
        Task<Text> resultTask = recognizer.process(image);
        Text result = Tasks.await(resultTask); // Wait synchronously
        return result.getText();
    }

    /**
     * Extracts text from a Base64 PDF by rendering pages to Bitmaps and running OCR,
     * or by using a local PDF extraction library like iText/PdfBox.
     * Here we simulate standard Android PdfRenderer extraction flow.
     */
    public static String extractTextFromBase64Pdf(Context context, String base64Uri) throws Exception {
        String base64Data = base64Uri.substring(base64Uri.indexOf(",") + 1);
        byte[] pdfBytes = Base64.decode(base64Data, Base64.DEFAULT);
        
        // Write to temp file to use PdfRenderer
        File tempFile = File.createTempFile("temp_pdf", ".pdf", context.getCacheDir());
        try (FileOutputStream fos = new FileOutputStream(tempFile)) {
            fos.write(pdfBytes);
        }
        
        return extractTextFromPdfFile(context, tempFile);
    }

    public static String extractTextFromPdfUri(Context context, Uri uri) throws Exception {
        // Implementation would copy URI to temp file or use ContentResolver ParcelFileDescriptor
        ParcelFileDescriptor fd = context.getContentResolver().openFileDescriptor(uri, "r");
        return extractTextUsingPdfRenderer(fd);
    }

    private static String extractTextFromPdfFile(Context context, File pdfFile) throws Exception {
        ParcelFileDescriptor fd = ParcelFileDescriptor.open(pdfFile, ParcelFileDescriptor.MODE_READ_ONLY);
        return extractTextUsingPdfRenderer(fd);
    }

    private static String extractTextUsingPdfRenderer(ParcelFileDescriptor fd) throws Exception {
        StringBuilder extractedText = new StringBuilder();
        PdfRenderer renderer = new PdfRenderer(fd);
        
        // Loop through all pages
        int pageCount = renderer.getPageCount();
        for (int i = 0; i < pageCount; i++) {
            PdfRenderer.Page page = renderer.openPage(i);
            
            // Render page to bitmap
            Bitmap bitmap = Bitmap.createBitmap(
                    page.getWidth() * 2, page.getHeight() * 2, Bitmap.Config.ARGB_8888);
            page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY);
            page.close();
            
            // Run OCR on the bitmap (Fallback offline parsing technique if no pure-text extractor is linked)
            InputImage image = InputImage.fromBitmap(bitmap, 0);
            extractedText.append("--- Page ").append(i + 1).append(" ---\n");
            extractedText.append(runMlKitOcr(image));
            extractedText.append("\n\n");
            
            bitmap.recycle();
        }
        renderer.close();
        fd.close();
        
        return extractedText.toString();
    }
}

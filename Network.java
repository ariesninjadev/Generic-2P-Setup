import java.io.BufferedReader;
import java.io.IOException;
import java.net.URL;
import java.net.HttpURLConnection;
import java.io.InputStreamReader;

/**
 * Write a description of class Network here.
 * 
 * @author (your name) 
 * @version (a version number or a date)
 */
public class Network  
{
    
    final static String host = "http://localhost:9898/";

    /**
     * Constructor for objects of class Network
     */
    public Network()
    {
    }
    
    private static String id;
    private static String pid;
    
    private static int extractValue(String jsonString, String key) {
        int index = jsonString.indexOf("\"" + key + "\":");
        if (index == -1)
            return -1; // Key not found

        index += key.length() + 3; // move index to start of value
        int endIndex = jsonString.indexOf(",", index);
        if (endIndex == -1) {
            endIndex = jsonString.indexOf("}", index);
        }
        String valueString = jsonString.substring(index, endIndex).trim();
        return Integer.parseInt(valueString);
    }
    
    private static String get(String url) throws IOException {
        // Create a URL object from the specified URL string
        URL urlObj = new URL(url);
        
        // Create a HttpURLConnection object
        HttpURLConnection connection = (HttpURLConnection) urlObj.openConnection();
        
        // Set the request method to GET
        connection.setRequestMethod("GET");
        
        //HttpsURLConnection.setDefaultHostnameVerifier((hostname, sslSession) -> true);
        
        // Set the read timeout (in milliseconds)
        connection.setReadTimeout(5000);
        
        // Establish connection
        connection.connect();
        
        // Check if the response code is OK
        if (connection.getResponseCode() == HttpURLConnection.HTTP_OK) {
            // Read the response body
            BufferedReader in = new BufferedReader(new InputStreamReader(connection.getInputStream()));
            StringBuilder response = new StringBuilder();
            String inputLine;
            while ((inputLine = in.readLine()) != null) {
                response.append(inputLine);
            }
            in.close();
            // Close the connection
            connection.disconnect();
            // Return the response as a string
            return response.toString();
        } else {
            // Close the connection
            connection.disconnect();
            // Return null if the response code is not OK
            return null;
        }
    }
    
    public static String joinGame(String uid) throws IOException {
        id = uid;
        pid = get(host+"api/join/"+id);
        return (pid);
    }
    
    public static String postLocation(int x, int y) throws IOException {
        return (get(host+"api/set/"+id+"/"+pid+"/"+x+"/"+y+"/"+"false"));
    }
    
    public static int[] getPartnerLocation() throws IOException {
        String qid;
        if (pid.equals("1")) {
            qid = "2";
        } else {
            qid = "1";
        }
        String data = get(host+"api/get/"+id+"/"+qid);
        String[] xdata = data.split(",");
        return (new int[]{Integer.parseInt(xdata[0]),Integer.parseInt(xdata[1])});
    }
    
}
